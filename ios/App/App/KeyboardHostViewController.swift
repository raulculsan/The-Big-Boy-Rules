import UIKit
import WebKit
import Capacitor

/// UIKit owns the available height. No delayed plugin resize or second JS animation.
final class KeyboardHostViewController: UIViewController {
    private let content = ClubBridgeViewController()
    private var bottomConstraint: NSLayoutConstraint?

    override var childForStatusBarStyle: UIViewController? { content }
    override var childForStatusBarHidden: UIViewController? { content }

    override func viewDidLoad() {
        super.viewDidLoad()
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
        let webConfiguration = super.webViewConfiguration(for: configuration)
        webConfiguration.userContentController.addUserScript(WKUserScript(
            source: "window.__bigboysNativeKeyboardLayout = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        return webConfiguration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.scrollView.keyboardDismissMode = .interactive
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.backgroundColor = view.backgroundColor
    }
}
