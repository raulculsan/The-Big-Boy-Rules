import UIKit
import Capacitor
import Photos
import PhotosUI
import UniformTypeIdentifiers

/// Request library consent once, then open the system gallery without a source menu.
@objc(ClubGalleryPlugin)
final class ClubGalleryPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    let identifier = "ClubGalleryPlugin"
    let jsName = "ClubGallery"
    let pluginMethods: [CAPPluginMethod] = ["pickMedia", "releaseFile", "openSettings"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var pending: CAPPluginCall?
    private var temporaryFiles = Set<String>()
    private let maximumBytes: Int64 = 50 * 1024 * 1024

    override func load() {
        let directory = FileManager.default.temporaryDirectory
        if let items = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            for item in items where item.lastPathComponent.hasPrefix("club-gallery-") {
                try? FileManager.default.removeItem(at: item)
            }
        }
    }

    @objc func pickMedia(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("La galería ya está abierta.", "BUSY"); return }
            self.pending = call
            let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            if status == .notDetermined {
                PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
                    DispatchQueue.main.async { self.presentGallery(status) }
                }
            } else { self.presentGallery(status) }
        }
    }

    private func presentGallery(_ status: PHAuthorizationStatus) {
        guard let call = pending else { return }
        guard status == .authorized || status == .limited else {
            pending = nil
            call.reject("Activa el acceso a Fotos para abrir tu galería.", "PHOTO_PERMISSION_DENIED")
            return
        }
        guard let controller = bridge?.viewController, controller.presentedViewController == nil else {
            pending = nil
            call.reject("Cierra la pantalla abierta e inténtalo de nuevo.")
            return
        }
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .any(of: [.images, .videos])
        configuration.selectionLimit = 1
        configuration.preferredAssetRepresentationMode = .current
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        controller.view.endEditing(true)
        controller.present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pending else { return }
        guard let item = results.first?.itemProvider else {
            pending = nil
            call.resolve(["cancelled": true])
            return
        }
        // Preserve the original representation, including animated GIFs and videos.
        guard let typeIdentifier = item.registeredTypeIdentifiers.first(where: {
            guard let type = UTType($0) else { return false }
            return type.conforms(to: .image) || type.conforms(to: .movie)
        }) else {
            pending = nil
            call.reject("No se puede abrir este archivo.")
            return
        }
        item.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { source, error in
            do {
                if let error = error { throw error }
                guard let source = source else { throw GalleryError.unavailable }
                let size = (try FileManager.default.attributesOfItem(atPath: source.path)[.size] as? NSNumber)?.int64Value ?? 0
                guard size <= self.maximumBytes else { throw GalleryError.tooLarge }
                let type = UTType(typeIdentifier)
                let ext = source.pathExtension.isEmpty ? (type?.preferredFilenameExtension ?? "jpg") : source.pathExtension
                let destination = FileManager.default.temporaryDirectory.appendingPathComponent("club-gallery-\(UUID().uuidString).\(ext)")
                try FileManager.default.copyItem(at: source, to: destination)
                let name = (item.suggestedName.map { ($0 as NSString).deletingPathExtension } ?? "Galería") + "." + ext
                DispatchQueue.main.async {
                    self.temporaryFiles.insert(destination.path)
                    self.pending = nil
                    call.resolve(["path": destination.path, "name": name,
                                  "type": type?.preferredMIMEType ?? "application/octet-stream"])
                }
            } catch {
                DispatchQueue.main.async {
                    self.pending = nil
                    let message = (error as? GalleryError)?.message ?? "No se pudo cargar la foto o vídeo. Si está en iCloud, comprueba tu conexión."
                    call.reject(message)
                }
            }
        }
    }

    @objc func releaseFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let path = call.getString("path"), self.temporaryFiles.remove(path) != nil {
                try? FileManager.default.removeItem(atPath: path)
            }
            call.resolve()
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.resolve(); return }
            UIApplication.shared.open(url, options: [:]) { _ in call.resolve() }
        }
    }

    private enum GalleryError: Error {
        case unavailable, tooLarge
        var message: String {
            switch self {
            case .tooLarge: return "El archivo supera el máximo de 50 MB."
            case .unavailable: return "No se pudo cargar la foto o vídeo."
            }
        }
    }
}
