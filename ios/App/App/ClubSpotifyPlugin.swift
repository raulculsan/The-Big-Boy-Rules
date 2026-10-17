import UIKit
import Capacitor
import SpotifyiOS
import Security
import CryptoKit
import AuthenticationServices
import Network

/// Music stays in the official Spotify app; only playback controls/state cross the bridge.
@objc(ClubSpotifyPlugin)
final class ClubSpotifyPlugin: CAPPlugin, CAPBridgedPlugin, SPTAppRemoteDelegate, SPTAppRemotePlayerStateDelegate, ASWebAuthenticationPresentationContextProviding {
    let identifier = "ClubSpotifyPlugin"
    let jsName = "ClubSpotify"
    let pluginMethods: [CAPPluginMethod] = ["configure", "connect", "disconnect", "command", "getState"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private static weak var active: ClubSpotifyPlugin?
    private static var pendingURL: URL?
    private let redirect = URL(string: "bigboyrules://spotify-callback")!
    private var remote: SPTAppRemote?
    private var clientId = ""
    private var owner = ""
    private var reconnect = false
    private var connecting = false
    private var retryCount = 0
    private var networkWasAvailable = false
    private var retryWork: DispatchWorkItem?
    private var connectionTimeout: DispatchWorkItem?
    private var foreground = false
    private let networkMonitor = NWPathMonitor()
    private var reconnectNotBefore = Date.distantPast
    private var commandCall: CAPPluginCall?
    private var commandTimeout: DispatchWorkItem?
    private var commandNotBefore = Date.distantPast
    private var controlsNeedAuthorization = false
    private var webDevice = ""
    private var webDeviceControllable = false
    private var webActions: [String: Any] = [:]
    private var playbackGeneration = 0
    private var wakeEpoch: Int?
    private var wakeStartedAt = Date.distantPast
    private struct Credentials: Codable {
        var access: String
        var refresh: String
        var expires: Date
        var scope: String? = nil
    }
    private var credentials: Credentials?
    private var authSession: ASWebAuthenticationSession?
    private var authState = ""
    private var verifier = ""
    private var epoch = 0
    private var refreshing = false
    private var tokenWaiters: [(String?) -> Void] = []
    private var queueLoading = false
    private var queueUpdated = Date.distantPast
    private var queueNotBefore = Date.distantPast
    private var queue: [[String: Any]] = []
    private var queueStatus = "unlinked"
    private var playbackLoading = false
    private var playbackUpdated = Date.distantPast
    private var playbackNotBefore = Date.distantPast
    private var playbackStatus = "unlinked"
    private var webPlayback: [String: Any] = [:]
    private var authorizationOwner: String? {
        get { UserDefaults.standard.string(forKey: "club.spotify.authorizationOwner") }
        set { UserDefaults.standard.set(newValue, forKey: "club.spotify.authorizationOwner") }
    }
    private var isActive: Bool {
        UIApplication.shared.connectedScenes.contains { $0.activationState == .foregroundActive }
            || UIApplication.shared.applicationState == .active
    }
    private var snapshot: [String: Any] = [:]
    private var artworkURI = ""
    private var message = ""
    private var keychainAccount: String { "\(clientId):\(owner)" }

    override func load() {
        Self.active = self
        foreground = isActive
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self else { return }
                let restored = path.status == .satisfied && !self.networkWasAvailable
                self.networkWasAvailable = path.status == .satisfied
                guard restored, self.foreground, self.isActive, self.credentials != nil else { return }
                // Network changes refresh web playback; a closed Spotify app is
                // only retried when the user returns to Big Boy or taps Connect.
                self.refreshQueue()
            }
        }
        networkMonitor.start(queue: DispatchQueue(label: "club.spotify.network"))
        NotificationCenter.default.addObserver(self, selector: #selector(becameActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(resignedActive), name: UIApplication.willResignActiveNotification, object: nil)
    }
    deinit {
        networkMonitor.cancel()
        commandTimeout?.cancel()
        retryWork?.cancel()
        connectionTimeout?.cancel()
        NotificationCenter.default.removeObserver(self)
    }
    static func sceneBecameActive() { active?.becameActive() }
    static func sceneResignedActive() { active?.resignedActive() }

    static func handleURL(_ url: URL) -> Bool {
        guard url.scheme == "bigboyrules", url.host == "spotify-callback" else { return false }
        if let plugin = active, plugin.remote != nil { plugin.acceptAuthorization(url) }
        else { pendingURL = url }
        return true
    }
    @objc func configure(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let id = call.getString("clientId") ?? ""
            let user = call.getString("owner") ?? ""
            if id != self.clientId || user != self.owner || self.remote == nil {
                self.cancelCommand()
                self.epoch += 1; self.wakeEpoch = nil
                self.authSession?.cancel(); self.authSession = nil
                self.authState = ""; self.verifier = ""
                self.refreshing = false; self.tokenWaiters.removeAll()
                self.queueLoading = false; self.queue = []; self.queueStatus = "unlinked"
                self.queueUpdated = .distantPast; self.queueNotBefore = .distantPast
                self.resetPlayback()
                self.credentials = nil
                self.reconnect = false
                self.cancelReconnectWork()
                self.retryCount = 0; self.reconnectNotBefore = .distantPast
                self.commandNotBefore = .distantPast; self.controlsNeedAuthorization = false
                self.remote?.delegate = nil
                self.remote?.playerAPI?.delegate = nil
                self.remote?.disconnect()
                self.remote = nil
                self.snapshot = [:]
                self.artworkURI = ""
                self.clientId = id
                self.owner = user
                self.message = ""
                self.connecting = false
                if !id.isEmpty && !user.isEmpty {
                    let config = SPTConfiguration(clientID: id, redirectURL: self.redirect)
                    let remote = SPTAppRemote(configuration: config, logLevel: .none)
                    remote.delegate = self
                    self.credentials = self.readCredentials()
                    remote.connectionParameters.accessToken = self.credentials?.access
                    self.remote = remote
                    self.reconnect = remote.connectionParameters.accessToken != nil
                    if let url = Self.pendingURL { Self.pendingURL = nil; self.reconnect = true; self.acceptAuthorization(url) }
                    else {
                        let configuredEpoch = self.epoch
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [self] in
                            guard self.epoch == configuredEpoch else { return }
                            self.attemptReconnect(); self.refreshQueue()
                        }
                    }
                }
            }
            call.resolve(self.payload())
        }
    }
    @objc func connect(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard self.remote != nil else { call.reject("Spotify estará disponible pronto."); return }
            guard UIApplication.shared.canOpenURL(URL(string: "spotify:")!) else { call.reject("Instala Spotify e inicia sesión para escuchar la playlist."); return }
            guard let uri = call.getString("uri"), self.validPlaylist(uri) else { call.reject("La playlist no está disponible."); return }
            self.cancelReconnectWork()
            self.retryCount = 0; self.reconnectNotBefore = .distantPast
            self.message = ""
            if self.credentials != nil && call.getBool("authorize") != true {
                self.reconnect = true
                self.withAccessToken { [weak self] token in
                    guard let self, token != nil else { return }
                    // Only an explicit tap opens Spotify and requests playback of the playlist.
                    self.wakeSpotify(uri: uri)
                    self.attemptReconnect()
                    self.refreshQueue(force: true)
                }
            } else {
                self.beginAuthorization(uri: call.getBool("authorize") == true ? nil : uri)
            }
            call.resolve(self.payload())
            self.publish()
        }
    }
    private func wakeSpotify(uri: String) {
        guard validPlaylist(uri), let remote else { return }
        let requestEpoch = epoch
        wakeEpoch = requestEpoch
        wakeStartedAt = Date()
        remote.authorizeAndPlayURI(uri) { [weak self] launched in
            DispatchQueue.main.async {
                guard let self, requestEpoch == self.epoch else { return }
                // This callback confirms app launch, not successful playback or authorization.
                if !launched { self.wakeEpoch = nil; self.wakeStartedAt = .distantPast; self.message = "No se ha podido abrir Spotify. Comprueba que esté instalado." }
                self.publish()
            }
        }
    }
    @objc func disconnect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.cancelCommand()
            self.epoch += 1; self.wakeEpoch = nil
            self.authSession?.cancel(); self.authSession = nil
            self.authState = ""; self.verifier = ""
            self.credentials = nil; self.refreshing = false; self.tokenWaiters.removeAll()
            self.queue = []; self.queueLoading = false; self.queueStatus = "unlinked"
            self.resetPlayback()
            self.reconnect = false
            self.cancelReconnectWork()
            self.authorizationOwner = nil
            self.connecting = false
            self.deleteToken()
            self.remote?.connectionParameters.accessToken = nil
            self.remote?.playerAPI?.delegate = nil
            self.remote?.disconnect()
            self.snapshot = [:]
            self.artworkURI = ""
            self.message = ""
            Self.pendingURL = nil
            call.resolve(self.payload())
            self.publish()
        }
    }
    private var hasControlScope: Bool {
        credentials?.scope?.split(separator: " ").contains("user-modify-playback-state") == true
    }
    private var webControlsAvailable: Bool {
        hasControlScope && !controlsNeedAuthorization && webDeviceControllable
            && playbackStatus == "ready" && Date().timeIntervalSince(playbackUpdated) < 30
            && Date() >= commandNotBefore
    }
    private func cancelCommand() {
        commandTimeout?.cancel(); commandTimeout = nil
        commandCall?.reject("La cuenta de Spotify ha cambiado. Vuelve a intentar la acción.")
        commandCall = nil
    }
    private func finishCommand(_ call: CAPPluginCall, requestEpoch: Int, error: String? = nil) {
        guard requestEpoch == epoch, commandCall === call else { return }
        commandCall = nil
        commandTimeout?.cancel(); commandTimeout = nil
        if let error { call.reject(error) }
        else {
            message = ""
            playbackGeneration += 1
            refresh(); refreshQueue(force: true)
            // Spotify applies commands asynchronously; read again after it has settled.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                guard let self, requestEpoch == self.epoch else { return }
                self.refresh(); self.refreshQueue(force: true)
            }
            call.resolve()
        }
        publish()
    }
    @objc func command(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard foreground, isActive else { call.reject("Vuelve a la app para controlar Spotify."); return }
            guard commandCall == nil else { call.reject("Espera a que Spotify termine la acción anterior."); return }
            guard let action = call.getString("action"), ["play", "pause", "resume", "next", "previous", "seek"].contains(action) else {
                call.reject("Control no disponible."); return
            }
            if action == "play", !validPlaylist(call.getString("uri") ?? "") { call.reject("La playlist no está disponible."); return }
            let requestEpoch = epoch
            commandCall = call
            let timeout = DispatchWorkItem { [weak self] in
                self?.finishCommand(call, requestEpoch: requestEpoch, error: "Spotify no ha confirmado la acción. Comprueba la reproducción antes de intentarlo de nuevo.")
            }
            commandTimeout = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 45, execute: timeout)
            if let remote, remote.isConnected, let api = remote.playerAPI {
                let callback: SPTAppRemoteCallback = { [weak self] _, error in
                    DispatchQueue.main.async {
                        self?.finishCommand(call, requestEpoch: requestEpoch,
                            error: error == nil ? nil : "Spotify no permite esta acción ahora. Comprueba tu cuenta y la reproducción.")
                    }
                }
                // Choose one transport before sending; never repeat an uncertain SDK command.
                switch action {
                case "play": api.play(call.getString("uri")!, callback: callback)
                case "pause": api.pause(callback)
                case "resume": api.resume(callback)
                case "next": api.skip(toNext: callback)
                case "previous": api.skip(toPrevious: callback)
                case "seek": api.seek(toPosition: max(0, call.getInt("position") ?? 0), callback: callback)
                default: break
                }
            } else if action == "play" {
                finishCommand(call, requestEpoch: requestEpoch, error: "Pulsa Abrir Spotify y volver a Big Boy para iniciar la playlist en este iPhone.")
            } else {
                webCommand(call, action: action, requestEpoch: requestEpoch)
            }
        }
    }
    private func webCommand(_ call: CAPPluginCall, action: String, requestEpoch: Int, retried: Bool = false) {
        guard requestEpoch == epoch, commandCall === call else { return }
        guard hasControlScope, !controlsNeedAuthorization else {
            controlsNeedAuthorization = true
            finishCommand(call, requestEpoch: requestEpoch, error: "Pulsa Activar controles y autoriza el control de reproducción en Spotify."); return
        }
        guard Date() >= commandNotBefore else {
            finishCommand(call, requestEpoch: requestEpoch, error: "Spotify pide esperar antes de otra acción. Los controles se recuperarán automáticamente."); return
        }
        guard webControlsAvailable, !webDevice.isEmpty else {
            refreshPlayback(force: true)
            finishCommand(call, requestEpoch: requestEpoch, error: "Pulsa Abrir Spotify y volver a Big Boy para recuperar la reproducción."); return
        }
        let restriction = ["pause": "pausing", "resume": "resuming", "next": "skipping_next", "previous": "skipping_prev", "seek": "seeking", "play": "interrupting_playback"][action]!
        guard webActions[restriction] as? Bool != true else {
            finishCommand(call, requestEpoch: requestEpoch, error: "Spotify restringe esta acción en la reproducción actual."); return
        }
        let device = webDevice
        withAccessToken(force: retried) { [weak self] token in
            guard let self, requestEpoch == self.epoch, self.commandCall === call else { return }
            guard let token else {
                self.finishCommand(call, requestEpoch: requestEpoch, error: "No se ha podido renovar Spotify. Tu cuenta sigue guardada si Spotify no ha revocado el acceso."); return
            }
            let ready = self.webDevice == device && self.webControlsAvailable
            guard self.foreground, self.isActive, ready else {
                self.finishCommand(call, requestEpoch: requestEpoch, error: "La reproducción de Spotify ha cambiado. Vuelve a intentar la acción."); return
            }
            let endpoint = action == "resume" ? "play" : action
            var components = URLComponents(string: "https://api.spotify.com/v1/me/player/\(endpoint)")!
            // Control the currently active Spotify playback without selecting or transferring a device.
            components.queryItems = []
            if action == "seek" {
                let duration = self.webPlayback["duration"] as? Int ?? 0
                let position = min(max(0, call.getInt("position") ?? 0), max(0, duration - 1))
                components.queryItems?.append(URLQueryItem(name: "position_ms", value: String(position)))
            }
            var request = URLRequest(url: components.url!)
            request.httpMethod = action == "next" || action == "previous" ? "POST" : "PUT"
            request.timeoutInterval = 15
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            URLSession.shared.dataTask(with: request) { data, response, _ in
                DispatchQueue.main.async {
                    guard requestEpoch == self.epoch, self.commandCall === call else { return }
                    let response = response as? HTTPURLResponse
                    let status = response?.statusCode ?? 0
                    if status == 401 && !retried {
                        self.webCommand(call, action: action, requestEpoch: requestEpoch, retried: true); return
                    }
                    if status == 204 { self.finishCommand(call, requestEpoch: requestEpoch); return }
                    let body = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
                    let detail = body?["error"] as? [String: Any]
                    let reason = detail?["reason"] as? String ?? ""
                    let apiMessage = (detail?["message"] as? String ?? "").lowercased()
                    let error: String
                    if status == 403 && (apiMessage.contains("scope") || apiMessage.contains("permission")) {
                        self.controlsNeedAuthorization = true
                        error = "Pulsa Activar controles y revisa los permisos de reproducción de Spotify."
                    } else if status == 403 && (reason == "PREMIUM_REQUIRED" || apiMessage.contains("premium")) {
                        error = "Spotify requiere Premium para controlar la reproducción desde la app."
                    } else if status == 403 {
                        error = "Spotify restringe esta acción. Comprueba tu cuenta Premium y el dispositivo activo."
                    } else if status == 404 {
                        self.webDeviceControllable = false
                        self.refreshPlayback(force: true)
                        error = "Spotify ya no ofrece ese dispositivo. Si Spotify está suspendido en el iPhone, hay que abrirlo para que vuelva a estar disponible."
                    } else if status == 429 {
                        self.commandNotBefore = Date().addingTimeInterval(max(1, Double(response?.value(forHTTPHeaderField: "Retry-After") ?? "60") ?? 60))
                        self.playbackNotBefore = max(self.playbackNotBefore, self.commandNotBefore)
                        self.queueNotBefore = max(self.queueNotBefore, self.commandNotBefore)
                        error = "Spotify pide esperar antes de otra acción. Los controles se recuperarán automáticamente."
                    } else if status == 401 {
                        self.controlsNeedAuthorization = true
                        error = "Revisa los permisos de Spotify para recuperar los controles."
                    } else {
                        // The server may have applied the command; do not repeat non-idempotent skips.
                        self.refreshPlayback(force: true)
                        error = "No se ha podido confirmar la acción de Spotify. Comprueba la reproducción antes de intentarlo de nuevo."
                    }
                    self.finishCommand(call, requestEpoch: requestEpoch, error: error)
                }
            }.resume()
        }
    }
    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            // Reading state must never start another local connection cycle.
            self.refreshQueue()
            guard let remote = self.remote, remote.isConnected, let api = remote.playerAPI else { call.resolve(self.payload()); return }
            api.getPlayerState { [weak self] result, _ in
                DispatchQueue.main.async {
                    guard let self else { call.reject("Spotify no está disponible."); return }
                    if remote === self.remote, remote.isConnected, let state = result as? SPTAppRemotePlayerState { self.update(state) }
                    call.resolve(self.payload())
                }
            }
        }
    }
    private func validPlaylist(_ uri: String) -> Bool { uri.range(of: "^spotify:playlist:[A-Za-z0-9]+$", options: .regularExpression) != nil }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }.first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
    }
    private func beginAuthorization(uri: String?) {
        guard authSession == nil else { return }
        cancelCommand()
        epoch += 1
        refreshing = false; tokenWaiters.removeAll(); queueLoading = false; playbackLoading = false
        let requestEpoch = epoch
        verifier = (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "")
        authState = UUID().uuidString
        authorizationOwner = keychainAccount
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        var url = URLComponents(string: "https://accounts.spotify.com/authorize")!
        url.queryItems = ["client_id": clientId, "response_type": "code", "redirect_uri": redirect.absoluteString,
            "scope": "app-remote-control user-read-playback-state user-modify-playback-state", "state": authState,
            "code_challenge_method": "S256", "code_challenge": challenge].map { URLQueryItem(name: $0.key, value: $0.value) }
        let session = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: redirect.scheme) { [weak self] callback, _ in
            DispatchQueue.main.async {
                guard let self, requestEpoch == self.epoch else { return }
                self.authSession = nil
                if let callback { self.acceptAuthorization(callback, playURI: uri) }
                else {
                    self.authorizationOwner = nil; self.authState = ""; self.verifier = ""
                    self.connecting = false; self.message = "Vinculación cancelada."; self.publish()
                }
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session; connecting = true
        if !session.start() {
            authSession = nil; connecting = false; authorizationOwner = nil
            authState = ""; verifier = ""; message = "No se ha podido abrir la vinculación de Spotify."
        }
        publish()
    }
    private func acceptAuthorization(_ url: URL, playURI: String? = nil) {
        if wakeEpoch == epoch, Date().timeIntervalSince(wakeStartedAt) <= 30, credentials != nil, authState.isEmpty,
           url.scheme == redirect.scheme, url.host == redirect.host, let remote {
            wakeEpoch = nil; wakeStartedAt = .distantPast
            let parameters = remote.authorizationParameters(from: url)
            if let access = parameters?[SPTAppRemoteAccessTokenKey], !access.isEmpty {
                // SDK access is transient; never overwrite the renewable PKCE credentials/scopes in Keychain.
                remote.connectionParameters.accessToken = access
                reconnect = true; retryCount = 0; reconnectNotBefore = .distantPast
                attemptReconnect(); refreshQueue(force: true)
            } else if parameters?[SPTAppRemoteErrorDescriptionKey] != nil {
                message = "Spotify no ha podido iniciar la reproducción. Tu cuenta sigue vinculada."
            }
            publish(); return
        }
        guard url.scheme == redirect.scheme, url.host == redirect.host,
              authorizationOwner == keychainAccount, !authState.isEmpty,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let values = Dictionary(parts.queryItems?.map { ($0.name, $0.value ?? "") } ?? [], uniquingKeysWith: { first, _ in first })
        guard values["state"] == authState else { return }
        let savedVerifier = verifier
        authorizationOwner = nil; authState = ""; verifier = ""
        guard let code = values["code"], !code.isEmpty else {
            connecting = false; message = "No se ha autorizado Spotify."; publish(); return
        }
        let requestEpoch = epoch
        tokenRequest(["grant_type": "authorization_code", "code": code, "redirect_uri": redirect.absoluteString,
                      "client_id": clientId, "code_verifier": savedVerifier]) { [weak self] body, status in
            guard let self, requestEpoch == self.epoch else { return }
            self.connecting = false
            if let body, let access = body["access_token"] as? String, let refresh = body["refresh_token"] as? String,
               !access.isEmpty, !refresh.isEmpty {
                let credentials = Credentials(access: access, refresh: refresh,
                    expires: Date().addingTimeInterval(body["expires_in"] as? Double ?? 3600), scope: body["scope"] as? String ?? "app-remote-control user-read-playback-state user-modify-playback-state")
                guard self.storeCredentials(credentials) else {
                    self.message = "No se ha podido guardar Spotify de forma segura. Vuelve a vincular."; self.publish(); return
                }
                self.controlsNeedAuthorization = false; self.commandNotBefore = .distantPast
                self.credentials = credentials; self.remote?.connectionParameters.accessToken = access
                self.reconnect = true; self.retryCount = 0; self.reconnectNotBefore = .distantPast; self.message = ""
                if let playURI { self.wakeSpotify(uri: playURI) }
                self.attemptReconnect(); self.refreshQueue(force: true)
            } else {
                self.message = status == 0 ? "Sin conexión. Vuelve a vincular Spotify cuando tengas internet." : "Spotify no ha podido completar la vinculación. Inténtalo de nuevo."
            }
            self.publish()
        }
    }
    private func tokenRequest(_ fields: [String: String], completion: @escaping ([String: Any]?, Int) -> Void) {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: ":#[]@!$&'()*+,;=?/\\")
        let body = fields.map { "\($0.key.addingPercentEncoding(withAllowedCharacters: allowed) ?? "")=\($0.value.addingPercentEncoding(withAllowedCharacters: allowed) ?? "")" }.joined(separator: "&")
        var request = URLRequest(url: URL(string: "https://accounts.spotify.com/api/token")!)
        request.httpMethod = "POST"; request.httpBody = Data(body.utf8); request.timeoutInterval = 20
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            DispatchQueue.main.async { completion(json, status) }
        }.resume()
    }
    private func withAccessToken(force: Bool = false, completion: @escaping (String?) -> Void) {
        guard let credentials else { completion(nil); return }
        if !force && credentials.expires.timeIntervalSinceNow > 90 { completion(credentials.access); return }
        tokenWaiters.append(completion)
        guard !refreshing else { return }
        refreshing = true
        let requestEpoch = epoch
        tokenRequest(["grant_type": "refresh_token", "refresh_token": credentials.refresh, "client_id": clientId]) { [weak self] body, status in
            guard let self, requestEpoch == self.epoch else { return }
            self.refreshing = false
            var access: String?
            if status == 200, let body, let token = body["access_token"] as? String, !token.isEmpty {
                let updated = Credentials(access: token, refresh: body["refresh_token"] as? String ?? credentials.refresh,
                    expires: Date().addingTimeInterval(body["expires_in"] as? Double ?? 3600), scope: body["scope"] as? String ?? credentials.scope)
                self.credentials = updated; self.remote?.connectionParameters.accessToken = token; access = token
                if !self.storeCredentials(updated) { self.message = "Spotify está conectado, pero no se ha podido guardar la renovación." }
            } else if body?["error"] as? String == "invalid_grant" {
                self.credentials = nil; self.deleteToken(); self.reconnect = false
                self.remote?.connectionParameters.accessToken = nil; self.remote?.disconnect()
                self.queue = []; self.queueStatus = "authorization"
                self.resetPlayback(); self.playbackStatus = "authorization"
                self.snapshot = [:]; self.artworkURI = ""
                self.message = "Spotify ha revocado la vinculación. Vincula de nuevo tu cuenta."
            } else {
                self.message = "Tu cuenta sigue guardada. No se ha podido renovar Spotify; reintentaremos la conexión."
            }
            let waiters = self.tokenWaiters; self.tokenWaiters.removeAll()
            waiters.forEach { $0(access) }; self.publish()
        }
    }
    private func resetPlayback() {
        playbackLoading = false; playbackUpdated = .distantPast; playbackNotBefore = .distantPast
        playbackStatus = "unlinked"; webPlayback = [:]
        webDevice = ""; webDeviceControllable = false; webActions = [:]
    }
    // Read actual playback independently of the local App Remote connection.
    private func refreshPlayback(force: Bool = false, retried: Bool = false) {
        guard credentials != nil, authSession == nil, authState.isEmpty, foreground, isActive, !playbackLoading,
              Date() >= playbackNotBefore, force || Date().timeIntervalSince(playbackUpdated) > (playbackStatus == "ready" ? 10 : 60) else { return }
        playbackLoading = true
        // A confirmed empty result is settled state too. Background polls must not
        // replace it with a shorter loading message and shift the Home layout.
        if playbackStatus == "unlinked" { playbackStatus = "loading" }
        let requestEpoch = epoch
        let requestGeneration = playbackGeneration
        withAccessToken(force: retried) { [weak self] token in
            guard let self, requestEpoch == self.epoch else { return }
            guard let token else {
                self.playbackLoading = false
                if self.playbackStatus != "authorization" { self.playbackStatus = "unavailable" }
                self.playbackUpdated = Date(); self.publish(); return
            }
            guard self.foreground, self.isActive else { self.playbackLoading = false; return }
            var request = URLRequest(url: URL(string: "https://api.spotify.com/v1/me/player?additional_types=episode")!)
            request.timeoutInterval = 15
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            URLSession.shared.dataTask(with: request) { data, response, _ in
                DispatchQueue.main.async {
                    guard requestEpoch == self.epoch else { return }
                    self.playbackLoading = false
                    guard self.foreground, self.isActive else { return }
                    guard requestGeneration == self.playbackGeneration else { self.refreshPlayback(force: true); return }
                    self.playbackUpdated = Date()
                    let response = response as? HTTPURLResponse
                    let status = response?.statusCode ?? 0
                    if status == 401 && !retried { self.refreshPlayback(force: true, retried: true); return }
                    if status == 200, let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        let device = json["device"] as? [String: Any]
                        self.webDevice = device?["id"] as? String ?? ""
                        self.webDeviceControllable = device?["is_active"] as? Bool == true && device?["is_restricted"] as? Bool != true && !self.webDevice.isEmpty
                        let actions = json["actions"] as? [String: Any] ?? [:]
                        self.webActions = actions["disallows"] as? [String: Any] ?? actions
                        if let item = json["item"] as? [String: Any], let title = item["name"] as? String {
                            let artists = (item["artists"] as? [[String: Any]])?.compactMap { $0["name"] as? String }.joined(separator: ", ")
                            let album = item["album"] as? [String: Any]
                            let images = (album?["images"] ?? item["images"]) as? [[String: Any]]
                            let uri = item["uri"] as? String ?? ""
                            let changed = self.webPlayback["trackURI"] as? String != uri
                            self.webPlayback = ["title": title, "artist": artists ?? ((item["show"] as? [String: Any])?["name"] as? String ?? "Spotify"),
                                "trackURI": uri, "artwork": images?.first?["url"] as? String ?? "",
                                "duration": item["duration_ms"] as? Int ?? 0, "position": json["progress_ms"] as? Int ?? 0,
                                "paused": !(json["is_playing"] as? Bool ?? false), "speed": 1,
                                "positionUpdatedAt": Date().timeIntervalSince1970 * 1000]
                            self.playbackStatus = "ready"
                            if changed { self.refreshQueue(force: true, refreshCurrent: false) }
                        } else {
                            self.webPlayback = [:]; self.playbackStatus = "empty"
                        }
                    } else if status == 204 {
                        self.webPlayback = [:]; self.playbackStatus = "empty"
                        self.webDevice = ""; self.webDeviceControllable = false; self.webActions = [:]
                    } else {
                        // Retain the last good reading through temporary network/server failures.
                        self.playbackStatus = status == 401 || status == 403 ? "authorization" : "unavailable"
                        if status == 401 || status == 403 { self.webPlayback = [:] }
                        if status == 429 {
                            self.playbackNotBefore = Date().addingTimeInterval(max(1, Double(response?.value(forHTTPHeaderField: "Retry-After") ?? "60") ?? 60))
                            self.queueNotBefore = max(self.queueNotBefore, self.playbackNotBefore)
                            self.commandNotBefore = max(self.commandNotBefore, self.playbackNotBefore)
                        }
                    }
                    self.publish()
                }
            }.resume()
        }
    }
    private func refreshQueue(force: Bool = false, retried: Bool = false, refreshCurrent: Bool = true) {
        if refreshCurrent { refreshPlayback(force: force) }
        guard credentials != nil, authSession == nil, authState.isEmpty, foreground, isActive, !queueLoading,
              Date() >= queueNotBefore, force || Date().timeIntervalSince(queueUpdated) > (playbackStatus == "ready" ? 30 : 60) else { return }
        queueLoading = true
        if queueStatus == "unlinked" { queueStatus = "loading" }
        let requestEpoch = epoch
        withAccessToken(force: retried) { [weak self] token in
            guard let self, requestEpoch == self.epoch else { return }
            guard let token else { self.queueLoading = false; self.queueStatus = "unavailable"; self.publish(); return }
            var request = URLRequest(url: URL(string: "https://api.spotify.com/v1/me/player/queue")!)
            request.timeoutInterval = 15; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            URLSession.shared.dataTask(with: request) { data, response, _ in
                DispatchQueue.main.async {
                    guard requestEpoch == self.epoch else { return }
                    self.queueLoading = false; self.queueUpdated = Date()
                    let response = response as? HTTPURLResponse
                    let status = response?.statusCode ?? 0
                    if status == 401 && !retried { self.refreshQueue(force: true, retried: true); return }
                    if status == 200, let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let items = json["queue"] as? [[String: Any]] {
                        self.queue = items.prefix(20).map { item in
                            let artists = (item["artists"] as? [[String: Any]])?.compactMap { $0["name"] as? String }.joined(separator: ", ")
                            let album = item["album"] as? [String: Any]
                            let images = (album?["images"] ?? item["images"]) as? [[String: Any]]
                            return ["title": item["name"] as? String ?? "Sin título", "artist": artists ?? ((item["show"] as? [String: Any])?["name"] as? String ?? "Spotify"),
                                "uri": item["uri"] as? String ?? "", "artwork": images?.last?["url"] as? String ?? "", "duration": item["duration_ms"] as? Int ?? 0]
                        }
                        self.queueStatus = self.queue.isEmpty ? "empty" : "ready"
                    } else {
                        self.queue = []
                        self.queueStatus = status == 403 || status == 401 ? "authorization" : status == 204 ? "empty" : "unavailable"
                        if status == 429 {
                            self.queueNotBefore = Date().addingTimeInterval(max(1, Double(response?.value(forHTTPHeaderField: "Retry-After") ?? "60") ?? 60))
                            self.playbackNotBefore = max(self.playbackNotBefore, self.queueNotBefore)
                            self.commandNotBefore = max(self.commandNotBefore, self.queueNotBefore)
                        }
                    }
                    self.publish()
                }
            }.resume()
        }
    }
    @objc private func becameActive() {
        let enteredForeground = !foreground
        foreground = true
        if enteredForeground { retryCount = 0; reconnectNotBefore = .distantPast }
        // Returning after cancelling authorization must unlock the Connect button.
        if connecting && authorizationOwner != nil && authSession == nil {
            connecting = false
        }
        attemptReconnect()
        refreshQueue(force: enteredForeground)
        publish()
    }
    @objc private func resignedActive() {
        foreground = false
        cancelReconnectWork()
        connecting = false
        if remote?.isConnected == true { remote?.disconnect() }
    }
    private func cancelReconnectWork() {
        retryWork?.cancel(); retryWork = nil
        connectionTimeout?.cancel(); connectionTimeout = nil
    }
    private func attemptReconnect() {
        if let credentials, credentials.expires.timeIntervalSinceNow <= 90 {
            guard !refreshing, foreground, isActive else { return }
            withAccessToken { [weak self] token in if token != nil { self?.attemptReconnect() } }
            return
        }
        guard reconnect, foreground, isActive, let remote, !remote.isConnected,
              remote.connectionParameters.accessToken != nil, !connecting,
              Date() >= reconnectNotBefore, retryCount < 2 else { return }
        retryWork?.cancel(); retryWork = nil
        retryCount += 1
        connecting = true
        publish()
        // Never launch Spotify or start playback automatically.
        let timeout = DispatchWorkItem { [weak self, weak remote] in
            guard let self, let remote, remote === self.remote, self.connecting, !remote.isConnected else { return }
            self.connecting = false
            self.scheduleReconnect()
            self.publish()
        }
        connectionTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)
        remote.connect()
    }
    private func scheduleReconnect() {
        connectionTimeout?.cancel(); connectionTimeout = nil
        guard reconnect, foreground, isActive, retryWork == nil else { return }
        guard retryCount < 2 else {
            reconnectNotBefore = .distantFuture
            message = "Tu cuenta sigue vinculada. Abre Spotify para recuperar la conexión."
            return
        }
        let work = DispatchWorkItem { [weak self] in
            self?.retryWork = nil
            self?.attemptReconnect()
        }
        retryWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(max(1, retryCount)), execute: work)
    }
    func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
        guard appRemote === remote else { return }
        guard reconnect, foreground, isActive else { appRemote.disconnect(); return }
        cancelReconnectWork()
        retryCount = 0
        connecting = false
        message = ""
        appRemote.playerAPI?.delegate = self
        appRemote.playerAPI?.subscribe(toPlayerState: { [weak self] _, error in
            if error != nil { self?.message = "No se ha podido actualizar la reproducción."; self?.publish() }
        })
        refresh()
        publish()
    }
    func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
        guard appRemote === remote else { return }
        connecting = false
        if error != nil { scheduleReconnect() }
        publish()
    }
    func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
        guard appRemote === remote else { return }
        connecting = false
        // A transient connection failure must not forget the saved authorization.
        scheduleReconnect()
        publish()
    }
    func playerStateDidChange(_ playerState: SPTAppRemotePlayerState) { update(playerState) }
    private func refresh() {
        guard let remote, remote.isConnected else { return }
        remote.playerAPI?.getPlayerState { [weak self] result, _ in
            guard let self, remote === self.remote, remote.isConnected else { return }
            if let state = result as? SPTAppRemotePlayerState { self.update(state) }
        }
    }
    private func update(_ state: SPTAppRemotePlayerState) {
        guard let remote, remote.isConnected else { return }
        let track = state.track
        let restrictions = state.playbackRestrictions
        snapshot.merge([
            "title": track.name, "artist": track.artist.name, "trackURI": track.uri,
            "duration": track.duration, "position": state.playbackPosition, "speed": state.playbackSpeed,
            "positionUpdatedAt": Date().timeIntervalSince1970 * 1000,
            "paused": state.isPaused, "contextTitle": state.contextTitle,
            "canSkipNext": restrictions.canSkipNext, "canSkipPrevious": restrictions.canSkipPrevious, "canSeek": restrictions.canSeek
        ]) { _, new in new }
        if artworkURI != track.uri {
            refreshQueue(force: true)
            artworkURI = track.uri
            snapshot.removeValue(forKey: "artwork")
            let uri = track.uri
            remote.imageAPI?.fetchImage(forItem: track, with: CGSize(width: 240, height: 240)) { [weak self] result, _ in
                guard let self, remote === self.remote, remote.isConnected, self.artworkURI == uri, let image = result as? UIImage, let data = image.jpegData(compressionQuality: 0.8) else { return }
                self.snapshot["artwork"] = "data:image/jpeg;base64,\(data.base64EncodedString())"
                self.publish()
            }
        }
        publish()
    }
    private func payload() -> [String: Any] {
        let nativePlayback = remote?.isConnected == true && snapshot["title"] != nil
        var result: [String: Any] = nativePlayback ? snapshot : webPlayback
        result["artwork"] = result["artwork"] ?? ""
        result["contextTitle"] = result["contextTitle"] ?? ""
        result["currentAvailable"] = result["title"] != nil
        result["playbackStatus"] = nativePlayback ? "ready" : playbackStatus
        // Explicit empty fields prevent the JS bridge retaining a previous song after 204/unlink.
        if result["title"] == nil {
            result.merge(["title": "", "artist": "", "artwork": "", "trackURI": "", "contextTitle": "",
                          "duration": 0, "position": 0, "paused": true, "speed": 0]) { _, new in new }
        }
        result["configured"] = remote != nil
        result["installed"] = UIApplication.shared.canOpenURL(URL(string: "spotify:")!)
        let nativeControls = credentials != nil && remote?.isConnected == true && remote?.playerAPI != nil
        let controls = nativeControls || webControlsAvailable
        result["connected"] = nativeControls
        result["controlsAvailable"] = controls
        result["commandPending"] = commandCall != nil
        result["controlsNeedAuthorization"] = credentials != nil && (!hasControlScope || controlsNeedAuthorization)
        result["canToggle"] = nativeControls || (webControlsAvailable && webActions[(result["paused"] as? Bool == true) ? "resuming" : "pausing"] as? Bool != true)
        result["canPlay"] = nativeControls || (webControlsAvailable && webActions["interrupting_playback"] as? Bool != true)
        if !nativeControls {
            result["canSkipNext"] = webControlsAvailable && webActions["skipping_next"] as? Bool != true
            result["canSkipPrevious"] = webControlsAvailable && webActions["skipping_prev"] as? Bool != true
            result["canSeek"] = webControlsAvailable && webActions["seeking"] as? Bool != true
        }
        result["authorizing"] = authSession != nil || !authState.isEmpty
        result["connecting"] = connecting
        result["linked"] = credentials != nil
        result["queue"] = queue
        result["queueStatus"] = queueStatus
        result["owner"] = owner
        result["message"] = message
        return result
    }
    private func publish() { notifyListeners("playerState", data: payload()) }
    private func keychainQuery() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.raulculsan.thebigboyrules.spotify", kSecAttrAccount as String: keychainAccount]
    }
    private func readCredentials() -> Credentials? {
        var query = keychainQuery(); query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess, let data = value as? Data else { return nil }
        // Legacy access-token-only records cannot be renewed; a one-time authorization upgrades them.
        return try? JSONDecoder().decode(Credentials.self, from: data)
    }
    private func storeCredentials(_ credentials: Credentials) -> Bool {
        guard let data = try? JSONEncoder().encode(credentials) else { return false }
        let status = SecItemUpdate(keychainQuery() as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }
        var query = keychainQuery(); query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }
    private func deleteToken() { guard !clientId.isEmpty, !owner.isEmpty else { return }; SecItemDelete(keychainQuery() as CFDictionary) }
}
