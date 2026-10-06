import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Reuse the storyboard window, avoiding a second WebView/bridge on launch.
        if window == nil { window = UIWindow(windowScene: windowScene) }
        if !(window?.rootViewController is KeyboardHostViewController) {
            window?.rootViewController = KeyboardHostViewController()
        }
        window?.backgroundColor = UIColor(red: 8/255, green: 9/255, blue: 12/255, alpha: 1)
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
