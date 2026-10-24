import UIKit
import WebKit
import Capacitor
import OSLog

/// One clock spans the native/WebKit boundary. performance.now() alone starts
/// too late to account for WebKit process creation after an app update.
enum ClubLaunchMetrics {
    private static let logger = Logger(subsystem: "com.raulculsan.thebigboyrules", category: "Startup")
    private static var started = ProcessInfo.processInfo.systemUptime
    private static var marks = Set<String>()

    static func begin() {
        started = ProcessInfo.processInfo.systemUptime
        let defaults = UserDefaults.standard
        let key = "bb-last-installation-path"
        let installation = Bundle.main.bundleURL.path
        let changed = defaults.string(forKey: key) != installation
        defaults.set(installation, forKey: key)
        #if DEBUG
        let mode = "debug"
        #else
        let mode = "release"
        #endif
        logger.notice("[BigBoy native startup] launch: 0 ms (\(mode, privacy: .public), installation-changed=\(changed, privacy: .public))")
    }

    static func mark(_ name: String) {
        guard marks.insert(name).inserted else { return }
        let ms = Int((ProcessInfo.processInfo.systemUptime - started) * 1000)
        logger.notice("[BigBoy native startup] \(name, privacy: .public): \(ms, privacy: .public) ms")
    }
}

private final class ClubStartupMessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let mark = message.body as? String,
              ["document-start", "dom-ready-frame", "shell-ready"].contains(mark) else { return }
        ClubLaunchMetrics.mark(mark)
    }
}

/// UIKit owns the available height. No delayed plugin resize or second JS animation.
final class KeyboardHostViewController: UIViewController {
    private let content = ClubBridgeViewController()
    private var bottomConstraint: NSLayoutConstraint?

    override var childForStatusBarStyle: UIViewController? { content }
    override var childForStatusBarHidden: UIViewController? { content }

    override func viewDidLoad() {
        super.viewDidLoad()
        ClubLaunchMetrics.mark("host-ready")
        view.backgroundColor = UIColor(red: 8/255, green: 9/255, blue: 12/255, alpha: 1)
        overrideUserInterfaceStyle = .dark
        let keyboard = view.keyboardLayoutGuide
        keyboard.followsUndockedKeyboard = false
        if #available(iOS 17.0, *) {
            // CSS accounts for the home indicator when the keyboard is closed.
            keyboard.usesBottomSafeArea = false
        }
        addChild(content)
        view.addSubview(content.view)
        content.view.translatesAutoresizingMaskIntoConstraints = false
        let bottom = content.view.bottomAnchor.constraint(equalTo: keyboard.topAnchor)
        bottomConstraint = bottom
        NSLayoutConstraint.activate([
            content.view.topAnchor.constraint(equalTo: view.topAnchor),
            content.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            content.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottom
        ])
        content.didMove(toParent: self)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if #available(iOS 17.0, *) { return }
        // iOS 15–16 tie the hidden guide to the safe area, not the screen bottom.
        let keyboard = view.keyboardLayoutGuide.layoutFrame
        let resting = keyboard.minY >= view.bounds.height - view.safeAreaInsets.bottom - 1
        let inset = resting ? view.safeAreaInsets.bottom : 0
        if bottomConstraint?.constant != inset { bottomConstraint?.constant = inset }
    }
}

final class ClubBridgeViewController: CAPBridgeViewController {
    override func webViewConfiguration(for configuration: InstanceConfiguration) -> WKWebViewConfiguration {
        ClubLaunchMetrics.mark("webview-configuration")
        return super.webViewConfiguration(for: configuration)
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        // Capacitor replaces userContentController after webViewConfiguration().
        // Install on the final controller, otherwise both this measurement and
        // the native keyboard-layout flag are silently discarded before load.
        configuration.userContentController.add(ClubStartupMessageHandler(), name: "bigboyStartup")
        configuration.userContentController.addUserScript(WKUserScript(
            source: """
            window.__bigboysNativeKeyboardLayout = true;
            (() => {
              const mark = name => window.webkit.messageHandlers.bigboyStartup.postMessage(name);
              mark('document-start');
              document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => requestAnimationFrame(() => mark('dom-ready-frame'))), {once:true});
              document.addEventListener('bb:launch-ready', () => mark('shell-ready'), {once:true});
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        return super.webView(with: frame, configuration: configuration)
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        ClubLaunchMetrics.mark("bridge-ready")
        bridge?.registerPluginInstance(ClubPlanWidgetPlugin())
        bridge?.registerPluginInstance(ClubSpotifyPlugin())
        bridge?.registerPluginInstance(ClubGalleryPlugin())
        bridge?.registerPluginInstance(ClubPushPlugin())
        bridge?.registerPluginInstance(ClubAuthPlugin())
        bridge?.registerPluginInstance(ClubDeepLinkPlugin())
        webView?.scrollView.keyboardDismissMode = .interactive
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.backgroundColor = view.backgroundColor
    }
}
