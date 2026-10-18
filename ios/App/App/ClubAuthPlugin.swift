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

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard self.pending == nil else { call.reject("Ya hay una vinculación abierta."); return }
            guard let raw = call.getString("url"), let url = URL(string: raw),
                  url.scheme == "https", url.host == "nfvggpgeypkkqceivkaq.supabase.co",
                  url.path.hasPrefix("/auth/v1/") else {
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
