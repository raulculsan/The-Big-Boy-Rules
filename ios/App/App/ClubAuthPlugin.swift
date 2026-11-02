import UIKit
import Capacitor
import AuthenticationServices

/// Browser-based identity linking returns only an authorization code to the WebView.
/// The PKCE verifier stays in the originating WebView's Supabase session storage.
@objc(ClubAuthPlugin)
final class ClubAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    let identifier = "ClubAuthPlugin"
    let jsName = "ClubAuth"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)]
    private var session: ASWebAuthenticationSession?
    private var pending: CAPPluginCall?

    /// Sign-in starts at Supabase; linking an identity gets Google's consent page, which must return to Supabase.
    private static func authorizeURL(_ url: URL) -> Bool {
        guard url.scheme == "https", url.user == nil, url.password == nil, url.port == nil || url.port == 443 else { return false }
        if url.host == "nfvggpgeypkkqceivkaq.supabase.co" { return url.path.hasPrefix("/auth/v1/") }
        let redirect = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "redirect_uri" }?.value
        return url.host == "accounts.google.com" && url.path.hasPrefix("/o/oauth2/")
            && redirect == "https://nfvggpgeypkkqceivkaq.supabase.co/auth/v1/callback"
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard self.pending == nil else { call.reject("Ya hay una vinculación abierta."); return }
            guard let raw = call.getString("url"), let url = URL(string: raw), Self.authorizeURL(url) else {
                call.reject("La dirección de vinculación no es válida."); return
            }
            self.pending = call
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "bigboyrules") { [weak self] callback, error in
                DispatchQueue.main.async { [weak self] in
                    guard let self = self, let call = self.pending else { return }
                    self.pending = nil
                    self.session = nil
                    if let callback = callback, callback.host == "auth", callback.path == "/callback" {
                        call.resolve(["url": callback.absoluteString])
                    } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                        call.reject("Has cancelado la vinculación.", "CANCELLED")
                    } else { call.reject("No se pudo completar la vinculación. Vuelve a intentarlo.") }
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                self.pending = nil
                call.reject("No se pudo abrir la ventana segura de acceso.")
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
