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
    private var restingConstraint: NSLayoutConstraint?

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
        restingConstraint = content.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([
            content.view.topAnchor.constraint(equalTo: view.topAnchor),
            content.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            content.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottom
        ])
        content.didMove(toParent: self)
    }

    /// While a chat rides the keyboard the WebView keeps its full height, so the
    /// web layer can translate its content in step with the keyboard. Resizing
    /// afterwards is invisible: the raised content already sits above the new edge.
    func holdFullHeight(_ hold: Bool) {
        UIView.performWithoutAnimation {
            restingConstraint?.constant = 0
            if hold { bottomConstraint?.isActive = false; restingConstraint?.isActive = true }
            else { restingConstraint?.isActive = false; bottomConstraint?.isActive = true }
            view.layoutIfNeeded()
        }
    }

    /// WebKit applies the new scroll offset a frame after the new size. A still of
    /// the settled screen hides that frame; the keyboard itself is left uncovered.
    func settleBehindStill() -> UIView? {
        guard let screen = view.window?.screen else { holdFullHeight(false); return nil }
        let keyboardTop = view.keyboardLayoutGuide.layoutFrame.minY
        let still = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: keyboardTop))
        still.clipsToBounds = true
        still.isUserInteractionEnabled = false
        still.accessibilityElementsHidden = true
        still.addSubview(screen.snapshotView(afterScreenUpdates: false))
        view.addSubview(still)
        holdFullHeight(false)
        return still
    }

    /// The guide starts growing the WebView as soon as the keyboard leaves. Freeze
    /// the current edge so the page can prepare before its size changes.
    func holdCurrentHeight() {
        UIView.performWithoutAnimation {
            restingConstraint?.constant = content.view.frame.maxY - view.bounds.height
            bottomConstraint?.isActive = false
            restingConstraint?.isActive = true
            view.layoutIfNeeded()
        }
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
        bridge?.registerPluginInstance(ClubChatKeyboardPlugin())
        webView?.scrollView.keyboardDismissMode = .interactive
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.backgroundColor = view.backgroundColor
    }
}

/// A transient render-server snapshot lets the keyboard travel with a live chat
/// during horizontal navigation. No keyboard window internals or image files.
@objc(ClubChatKeyboardPlugin)
final class ClubChatKeyboardPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ClubChatKeyboardPlugin"
    let jsName = "ClubChatKeyboard"
    let pluginMethods: [CAPPluginMethod] = ["prepare", "update", "settle", "finish", "setLift", "expand"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var observers: [NSObjectProtocol] = []
    private var keyboardFrame = CGRect.zero
    private var keyboardSurface: UIView?
    private weak var sourceResponder: UIResponder?
    private var animator: UIViewPropertyAnimator?
    private var settleCall: CAPPluginCall?
    private var restoreCall: CAPPluginCall?
    private var restoreTimeout: DispatchWorkItem?
    private var liftEnabled = false
    private var keyboardShown = false
    private var host: KeyboardHostViewController? { bridge?.viewController?.parent as? KeyboardHostViewController }

    private func keyboardMotion(_ notification: Notification) -> (height: CGFloat, duration: Double) {
        let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect ?? .zero
        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0
        return (max(0, UIScreen.main.bounds.height - frame.minY), duration)
    }

    private func beginLift(_ notification: Notification, showing: Bool) {
        guard liftEnabled, showing != keyboardShown else { return }
        keyboardShown = showing
        let motion = keyboardMotion(notification)
        // Closing waits for expand(): the page must be listening before its size changes.
        if showing { host?.holdFullHeight(true) } else { host?.holdCurrentHeight() }
        notifyListeners("lift", data: ["height": motion.height, "duration": motion.duration * 1000, "showing": showing])
    }

    override func load() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { [weak self] notification in
            self?.beginLift(notification, showing: true)
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main) { [weak self] notification in
            self?.beginLift(notification, showing: false)
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardDidShowNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            guard self.liftEnabled && self.keyboardShown else { self.host?.holdFullHeight(false); return }
            let still = self.host?.settleBehindStill()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { still?.removeFromSuperview() }
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardDidHideNotification, object: nil, queue: .main) { [weak self] _ in
            self?.host?.holdFullHeight(false)
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main) { [weak self] notification in
            if let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect { self?.keyboardFrame = frame }
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardDidShowNotification, object: nil, queue: .main) { [weak self] _ in
            self?.completeRestore(restored: true)
        })
    }

    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }

    @objc func setLift(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            liftEnabled = call.getBool("enabled") == true
            call.resolve()
        }
    }

    @objc func expand(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            host?.holdFullHeight(true)
            call.resolve()
        }
    }

    @objc func prepare(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard keyboardSurface == nil, let webView = webView, let window = webView.window else {
                call.resolve(["active": false]); return
            }
            let frame = window.convert(keyboardFrame, from: window.screen.coordinateSpace).intersection(window.bounds)
            // Hardware/floating keyboards have no full-width surface to move.
            guard frame.height > 100, frame.width >= window.bounds.width * 0.8 else {
                call.resolve(["active": false]); return
            }
            let screen = window.screen
            let snapshot = screen.snapshotView(afterScreenUpdates: false)
            let surface = UIView(frame: frame)
            surface.clipsToBounds = true
            surface.isUserInteractionEnabled = false
            surface.accessibilityElementsHidden = true
            let screenOrigin = window.convert(CGPoint.zero, to: screen.coordinateSpace)
            snapshot.frame = screen.bounds.offsetBy(dx: -frame.minX - screenOrigin.x, dy: -frame.minY - screenOrigin.y)
            surface.addSubview(snapshot)
            sourceResponder = firstResponder(in: webView)
            keyboardSurface = surface
            window.addSubview(surface)
            UIView.performWithoutAnimation {
                webView.endEditing(true)
                window.layoutIfNeeded()
            }
            call.resolve(["active": true])
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            keyboardSurface?.transform = CGAffineTransform(translationX: translation(for: call), y: 0)
            call.resolve()
        }
    }

    @objc func settle(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard let surface = keyboardSurface else { call.resolve(); return }
            stopAnimator()
            let duration = max(0, call.getDouble("duration") ?? 0) / 1000
            let target = CGAffineTransform(translationX: translation(for: call), y: 0)
            guard duration > 0 else { surface.transform = target; call.resolve(); return }
            let timing = UICubicTimingParameters(controlPoint1: CGPoint(x: 0.22, y: 0.8), controlPoint2: CGPoint(x: 0.25, y: 1))
            let animation = UIViewPropertyAnimator(duration: duration, timingParameters: timing)
            animator = animation
            settleCall = call
            animation.addAnimations { surface.transform = target }
            animation.addCompletion { [weak self] _ in
                self?.animator = nil
                self?.settleCall?.resolve()
                self?.settleCall = nil
            }
            animation.startAnimation()
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            stopAnimator()
            guard keyboardSurface != nil else { call.resolve(["restored": false]); return }
            guard call.getBool("restore") == true else {
                removeSurface(); call.resolve(["restored": false]); return
            }
            restoreCall = call
            let timeout = DispatchWorkItem { [weak self] in self?.completeRestore(restored: false) }
            restoreTimeout = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.48, execute: timeout)
            UIView.performWithoutAnimation {
                sourceResponder?.becomeFirstResponder()
                if let inputID = call.getString("inputId"),
                   let data = try? JSONSerialization.data(withJSONObject: inputID, options: .fragmentsAllowed),
                   let literal = String(data: data, encoding: .utf8) {
                    webView?.evaluateJavaScript("document.getElementById(\(literal))?.focus({preventScroll:true})")
                }
                webView?.window?.layoutIfNeeded()
            }
        }
    }

    private func translation(for call: CAPPluginCall) -> CGFloat {
        let width = max(1, call.getDouble("width") ?? 1)
        let progress = min(1, max(0, (call.getDouble("offset") ?? 0) / width))
        return (keyboardSurface?.bounds.width ?? 0) * progress
    }

    private func firstResponder(in view: UIView) -> UIResponder? {
        if view.isFirstResponder { return view }
        for child in view.subviews { if let responder = firstResponder(in: child) { return responder } }
        return nil
    }

    private func stopAnimator() {
        animator?.stopAnimation(true)
        animator = nil
        settleCall?.resolve()
        settleCall = nil
    }

    private func completeRestore(restored: Bool) {
        guard let call = restoreCall else { return }
        restoreCall = nil
        restoreTimeout?.cancel()
        restoreTimeout = nil
        removeSurface()
        call.resolve(["restored": restored])
    }

    private func removeSurface() {
        keyboardSurface?.removeFromSuperview()
        keyboardSurface = nil
        sourceResponder = nil
    }
}
