import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        if let response = connectionOptions.notificationResponse { ClubPushPlugin.handleResponse(response) }

        // Reuse the storyboard window, avoiding a second WebView/bridge on launch.
        if window == nil { window = UIWindow(windowScene: windowScene) }
        if !(window?.rootViewController is KeyboardHostViewController) {
            window?.rootViewController = KeyboardHostViewController()
        }
        window?.backgroundColor = UIColor(red: 8/255, green: 9/255, blue: 12/255, alpha: 1)
        window?.makeKeyAndVisible()

        let spotifyCallback = connectionOptions.urlContexts.contains { ClubSpotifyPlugin.handleURL($0.url) }
        if !spotifyCallback {
            SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        ClubSpotifyPlugin.sceneBecameActive()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        ClubSpotifyPlugin.sceneResignedActive()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        let remaining = Set(URLContexts.filter { !ClubSpotifyPlugin.handleURL($0.url) })
        if !remaining.isEmpty { SceneDelegateProxy.shared.scene(scene, openURLContexts: remaining) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
