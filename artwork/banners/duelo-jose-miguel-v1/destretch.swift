// Deshace el estirado vertical de Veo: entra RGBA 1280x720 y sale RGBA 1440x480.
// Uso: destretch <mirada|golpe>
import Foundation
let mode = CommandLine.arguments[1], IW = 1280, IH = 720, OW = 1440, OH = 480
var frame = 0
var inp = [UInt8](repeating: 0, count: IW * IH * 4), out = [UInt8](repeating: 255, count: OW * OH * 4)
while true {
  var got = 0
  let size = IW * IH * 4
  while got < size { let left = size - got, at = got; let n = inp.withUnsafeMutableBytes { read(0, $0.baseAddress! + at, left) }; if n <= 0 { exit(0) }; got += n }
  let t = Float(frame) / 24
  let h: Float = mode == "mirada" ? min(720, 405 + 47.5 * t) : (t < 4.3 ? 427 : 720)
  let y0 = (720 - h) / 2
  inp.withUnsafeBufferPointer { s in out.withUnsafeMutableBufferPointer { d in
    let sp = s.baseAddress!, dp = d.baseAddress!
    DispatchQueue.concurrentPerform(iterations: OH) { oy in
      let yf = y0 + (Float(oy) + 0.5) * h / Float(OH) - 0.5, yi = max(0, min(IH - 2, Int(yf))), fy = max(0, min(1, yf - Float(yi)))
      for ox in 0..<OW {
        let xf = (Float(ox) + 0.5) * Float(IW) / Float(OW) - 0.5, xi = max(0, min(IW - 2, Int(xf))), fx = max(0, min(1, xf - Float(xi)))
        for c in 0..<3 {
          let a = Float(sp[(yi * IW + xi) * 4 + c]) * (1 - fx) + Float(sp[(yi * IW + xi + 1) * 4 + c]) * fx
          let b = Float(sp[((yi + 1) * IW + xi) * 4 + c]) * (1 - fx) + Float(sp[((yi + 1) * IW + xi + 1) * 4 + c]) * fx
          dp[(oy * OW + ox) * 4 + c] = UInt8(a * (1 - fy) + b * fy)
        }
        dp[(oy * OW + ox) * 4 + 3] = 255
      } } } }
  out.withUnsafeBytes { p in var off = 0; while off < p.count { let n = write(1, p.baseAddress! + off, p.count - off); if n <= 0 { exit(1) }; off += n } }
  frame += 1
}
