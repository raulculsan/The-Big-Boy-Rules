// Renderiza los banners del duelo a RGBA crudo por stdout (1440x480, 24 fps).
// Uso: render <mirada|cruce|golpe> <carpeta src> | ffmpeg -f rawvideo ...
import Foundation
import CoreGraphics
import ImageIO

let SW = 2172, SH = 724, OW = 1440, OH = 480
let k = Float(SW) / Float(OW)
let tau = Float.pi * 2

final class Img {
  var p: [Float]
  init(_ path: String) {
    let s = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
    let c = CGImageSourceCreateImageAtIndex(s, 0, nil)!
    var b = [UInt8](repeating: 0, count: SW * SH * 4)
    let x = CGContext(data: &b, width: SW, height: SH, bitsPerComponent: 8, bytesPerRow: SW * 4,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    x.interpolationQuality = .high
    x.draw(c, in: CGRect(x: 0, y: 0, width: SW, height: SH))
    p = b.map { Float($0) }
  }
  @inline(__always) func at(_ x: Int, _ y: Int, _ c: Int) -> Float {
    p[(min(max(y, 0), SH - 1) * SW + min(max(x, 0), SW - 1)) * 4 + c]
  }
  @inline(__always) func sample(_ x: Float, _ y: Float) -> (Float, Float, Float, Float) {
    let xi = Int(floor(x)), yi = Int(floor(y)), fx = x - Float(xi), fy = y - Float(yi)
    func m(_ c: Int) -> Float {
      let a = at(xi, yi, c) * (1 - fx) + at(xi + 1, yi, c) * fx
      let b = at(xi, yi + 1, c) * (1 - fx) + at(xi + 1, yi + 1, c) * fx
      return a * (1 - fy) + b * fy
    }
    return (m(0), m(1), m(2), m(3))
  }
  func lum(_ x: Int, _ y: Int) -> Float { 0.3 * at(x, y, 0) + 0.59 * at(x, y, 1) + 0.11 * at(x, y, 2) }
}

func blur(_ a: inout [Float], _ r: Int) {
  for _ in 0..<3 {
    var b = a
    for y in 0..<SH { var s: Float = 0; for x in -r...r { s += a[y * SW + min(max(x, 0), SW - 1)] }
      for x in 0..<SW { b[y * SW + x] = s / Float(2 * r + 1)
        s += a[y * SW + min(x + r + 1, SW - 1)] - a[y * SW + max(x - r, 0)] } }
    for x in 0..<SW { var s: Float = 0; for y in -r...r { s += b[min(max(y, 0), SH - 1) * SW + x] }
      for y in 0..<SH { a[y * SW + x] = s / Float(2 * r + 1)
        s += b[min(y + r + 1, SH - 1) * SW + x] - b[max(y - r, 0) * SW + x] } }
  }
}
func ell(_ x: Int, _ y: Int, _ cx: Float, _ cy: Float, _ rx: Float, _ ry: Float) -> Bool {
  let a = (Float(x) - cx * 1.086) / (rx * 1.086), b = (Float(y) - cy * 1.086) / (ry * 1.086)
  return a * a + b * b < 1
}
// Campo de viento periódico en t (0..1): el bucle cierra sin salto.
@inline(__always) func wind(_ x: Float, _ y: Float, _ t: Float) -> (Float, Float) {
  let gust = 0.62 + 0.38 * sin(tau * t - x * 0.0018)
  let dx = 0.6 * sin(tau * 2 * t - x * 0.010 - y * 0.006) + 0.4 * sin(tau * 5 * t - x * 0.031 + y * 0.02)
  return (dx * gust, 0.45 * gust * sin(tau * 3 * t - x * 0.017 + y * 0.012))
}
func emit(_ frames: Int, _ draw: (Int, inout [UInt8]) -> Void) {
  var out = [UInt8](repeating: 255, count: OW * OH * 4)
  for f in 0..<frames { draw(f, &out); out.withUnsafeBytes { FileHandle.standardOutput.write(Data($0)) } }
}
func rows(_ body: @escaping (Int) -> Void) { DispatchQueue.concurrentPerform(iterations: OH, execute: body) }
func clip(_ v: Float) -> UInt8 { UInt8(max(0, min(255, v))) }
struct Leaf { let x, y, v, s, ph: Float }
func leaves(_ n: Int) -> [Leaf] {
  var g = SystemRandomNumberGenerator(); _ = g
  return (0..<n).map { i in let a = Float(i) * 2.399
    return Leaf(x: (sin(a * 3) * 0.5 + 0.5) * 1440, y: (sin(a * 7.1) * 0.5 + 0.5) * 300 + 20,
      v: Float(1 + i % 3), s: 3 + Float(i % 3) * 1.6, ph: a) }
}
func drawLeaves(_ L: [Leaf], _ t: Float, _ o: UnsafeMutablePointer<UInt8>, _ open: ((Int, Int) -> Bool)? = nil) {
  for l in L {
    let x = (l.x + 1600 * l.v * t).truncatingRemainder(dividingBy: 1600) - 80
    let y = l.y + 26 * sin(tau * 2 * t + l.ph) + 60 * t * 0
    let r = l.s, sq = 0.45 + 0.4 * abs(sin(tau * 3 * t + l.ph))
    for py in Int(y - r - 2)...Int(y + r + 2) where py >= 0 && py < OH {
      for px in Int(x - r * 2 - 2)...Int(x + r * 2 + 2) where px >= 0 && px < OW {
        let a = (Float(px) - x) / (r * 2), b = (Float(py) - y) / (r * sq)
        let d = a * a + b * b
        if d < 1 && (open?(px, py) ?? true) { let i = (py * OW + px) * 4, m = min(1, (1 - d) * 3)
          o[i] = clip(Float(o[i]) * (1 - m) + 196 * m); o[i + 1] = clip(Float(o[i + 1]) * (1 - m) + 222 * m); o[i + 2] = clip(Float(o[i + 2]) * (1 - m) + 96 * m) }
      }
    }
  }
}

func mirada(_ src: String) {
  let im = Img(src + "/duelo-faceoff.png")
  var A = [Float](repeating: 0, count: SW * SH)
  for y in 0..<SH { for x in 0..<SW {
    let person = ell(x, y, 325, 320, 145, 135) || ell(x, y, 285, 590, 225, 190) || ell(x, y, 345, 435, 75, 70)
      || ell(x, y, 1560, 125, 140, 145) || ell(x, y, 1610, 240, 80, 70) || ell(x, y, 1700, 440, 215, 290)
    var a: Float = person ? 0 : 5 + 15 * (1 - min(1, Float(y) / 520))
    let l = im.lum(x, y)
    if l < 92 && ((ell(x, y, 300, 275, 118, 85) && !(x > 340 && y > 290)) || (ell(x, y, 1590, 55, 140, 75) && !(x < 1760 && y > 90))) { a = 20 }
    if l > 110 && (ell(x, y, 285, 600, 205, 150) || ell(x, y, 1700, 440, 195, 270)) { a = 7 }
    A[y * SW + x] = a
  } }
  blur(&A, 6)
  // Las caras y cuellos quedan fijos: el viento nunca debe deformarlas.
  var F = [Float](repeating: 0, count: SW * SH)
  for y in 0..<SH { for x in 0..<SW {
    if ell(x, y, 372, 345, 112, 112) || ell(x, y, 345, 440, 80, 60) || ell(x, y, 1555, 150, 100, 115) || ell(x, y, 1620, 235, 80, 60) { F[y * SW + x] = 1 } } }
  blur(&F, 10)
  for i in 0..<SW * SH { A[i] *= max(0, 1 - F[i] * 1.6) }
  let L = leaves(18)
  emit(192) { f, out in
    let t = Float(f) / 192
    out.withUnsafeMutableBufferPointer { b in let o = b.baseAddress!
      rows { oy in for ox in 0..<OW {
        let x = (Float(ox) + 0.5) * k, y = (Float(oy) + 0.5) * k
        let ix = min(Int(x), SW - 1), iy = min(Int(y), SH - 1)
        let a = A[iy * SW + ix], (wx, wy) = wind(x, y, t)
        let s = im.sample(x - wx * a, y - wy * a), i = (oy * OW + ox) * 4
        o[i] = clip(s.0); o[i + 1] = clip(s.1); o[i + 2] = clip(s.2); o[i + 3] = 255
      } }
      drawLeaves(L, t, o) { px, py in A[min(Int(Float(py) * k), SH - 1) * SW + min(Int(Float(px) * k), SW - 1)] > 4 }
    }
  }
}

final class Cut { let im: Img; var A: [Float]
  init(_ path: String) { im = Img(path); A = [Float](repeating: 0, count: SW * SH)
    for i in 0..<SW * SH { let r = im.p[i * 4], g = im.p[i * 4 + 1], b = im.p[i * 4 + 2]
      let key = min(r, b) - g                         // magenta frente a verde
      let a = 1 - max(0, min(1, (key - 45) / 70)); A[i] = a
      if a < 1 { let m = min(g + 30, min(r, b)); im.p[i * 4] = min(r, m); im.p[i * 4 + 2] = min(b, m) } }
  }
  @inline(__always) func rgba(_ x: Float, _ y: Float) -> (Float, Float, Float, Float) {
    if x < 0 || y < 0 || x >= Float(SW - 2) || y >= Float(SH - 2) { return (0, 0, 0, 0) }
    let s = im.sample(x, y), xi = Int(x), yi = Int(y), fx = x - Float(xi), fy = y - Float(yi)
    let a0 = A[yi * SW + xi] * (1 - fx) + A[yi * SW + xi + 1] * fx
    let a1 = A[(yi + 1) * SW + xi] * (1 - fx) + A[(yi + 1) * SW + xi + 1] * fx
    return (s.0, s.1, s.2, a0 * (1 - fy) + a1 * fy)
  }
}
// Pose de caminar sobre un recorte: balanceo, cabeceo y brazos en oposición.
struct Walker { let c: Cut; let scale, baseY, x0, x1, armFront, armBack, phase: Float; let dir: Float }
func walkSample(_ w: Walker, _ X: Float, _ Y: Float, _ t: Float) -> (Float, Float, Float, Float) {
  let step = tau * 16 * t + w.phase
  let bob = abs(sin(step / 2)) * 15, cx = w.x0 + (w.x1 - w.x0) * t
  let ang = 0.016 * sin(step / 2) * w.dir
  var u = (X - cx) / w.scale, v = (Y - w.baseY + bob) / w.scale
  let c0 = cos(ang), s0 = sin(ang), py: Float = 720
  let ru = u * c0 - (v - py) * s0, rv = u * s0 + (v - py) * c0 + py
  u = ru; v = rv
  // Los brazos pivotan desde el hombro: más amplitud cuanto más abajo.
  let low = max(0, min(1, (v - 330) / 390))
  let front = u * w.dir > 110 ? 1 : (u * w.dir > 60 ? (u * w.dir - 60) / 50 : Float(0))
  let back = u * w.dir < -120 ? 1 : (u * w.dir < -70 ? (-u * w.dir - 70) / 50 : Float(0))
  let swing = sin(step / 2)
  u -= (front * w.armFront * swing - back * w.armBack * swing) * low * low
  return w.c.rgba(u + w.dir * -0 + (w.dir > 0 ? 430 : 1760), v)
}
func cruce(_ src: String) {
  let bg = Img(src + "/duelo-bosque.png"), J = Cut(src + "/duelo-jose-walk.png"), M = Cut(src + "/duelo-miguel-walk.png")
  let jose = Walker(c: J, scale: 0.895, baseY: 82, x0: -760, x1: 2900, armFront: 70, armBack: 60, phase: 0, dir: 1)
  let miguel = Walker(c: M, scale: 1.0, baseY: 6, x0: 2930, x1: -760, armFront: 70, armBack: 60, phase: 1.4, dir: -1)
  let L = leaves(12)
  let back = Img(src + "/duelo-final.png"), ej = Img(src + "/duelo-eyes-jose.png"), em = Img(src + "/duelo-eyes-miguel.png")
  // Como en la referencia: caminan, plano de espaldas, ojos de cada uno y siguen andando.
  emit(300) { f, out in
    let walking = f < 92 || f >= 200
    let t: Float = f < 92 ? Float(f) / 92 * 0.44 : 0.44 + Float(f - 200) / 100 * 0.56
    let n = Float(f)
    out.withUnsafeMutableBufferPointer { b in let o = b.baseAddress!
      rows { oy in for ox in 0..<OW {
        let x = (Float(ox) + 0.5) * k, y = (Float(oy) + 0.5) * k
        var c: (Float, Float, Float, Float)
        if walking {
          let a = (5 + 13 * (1 - min(1, y / 470))) * (y > 520 ? 0.35 : 1), (wx, wy) = wind(x, y, n / 300)
          c = bg.sample(x - wx * a, y - wy * a)
          for w in [miguel, jose] { let s = walkSample(w, x, y, t)
            if s.3 > 0 { c.0 = c.0 * (1 - s.3) + s.0 * s.3; c.1 = c.1 * (1 - s.3) + s.1 * s.3; c.2 = c.2 * (1 - s.3) + s.2 * s.3 } }
        } else {
          let g = n - (f < 132 ? 92 : f < 166 ? 132 : 166)
          let im = f < 132 ? back : f < 166 ? ej : em
          let z: Float = f < 132 ? 1.12 : 1.03 + 0.1 * g / 34
          let px: Float = f < 132 ? 40 - g * 2 : (f < 166 ? 30 - g * 1.8 : -30 + g * 1.8)
          let py: Float = f < 132 ? 7 * sin(g * 0.62) : 3 * sin(g * 0.62)
          c = im.sample(Float(SW) / 2 + (x - Float(SW) / 2) / z + px, Float(SH) / 2 + (y - Float(SH) / 2) / z + py)
          let fl = max(0, 1 - g / 3); c.0 += (255 - c.0) * fl; c.1 += (255 - c.1) * fl; c.2 += (255 - c.2) * fl
        }
        let i = (oy * OW + ox) * 4
        o[i] = clip(c.0); o[i + 1] = clip(c.1); o[i + 2] = clip(c.2); o[i + 3] = 255
      } }
    }
  }
}

// Golpe en 96 fotogramas: las dos poses clave sobre un único bosque.
func golpe(_ src: String) {
  let bg = Img(src + "/duelo-bosque.png"), hit = Cut(src + "/duelo-impact-3x1.png"), load = Cut(src + "/duelo-windup-cut.png")
  let cx = Float(SW) / 2, cy: Float = 362
  struct Rock { let a, v, s, ph: Float }
  let rocks = (0..<46).map { i -> Rock in let f = Float(i) * 2.399
    return Rock(a: f, v: 160 + (sin(f * 3.3) * 0.5 + 0.5) * 420, s: 3 + (sin(f * 5.1) * 0.5 + 0.5) * 9, ph: f) }
  emit(96) { f, out in
    let n = Float(f), impact = f < 40
    let sh = impact ? 30 * exp(-n / 9) + 2 : 0, sx = sh * sin(n * 2.3), sy = sh * 0.7 * cos(n * 3.1)
    let p = impact ? Float(0) : (n - 40) / 56, tense = min(1, p / 0.75)
    let rush = p > 0.8 ? pow((p - 0.8) / 0.2, 2) : 0
    let zb = 1.06 + (impact ? 0.03 * exp(-n / 8) : 0.02 * tense + 0.05 * rush)
    let lines = impact ? max(0, 1 - n / 26) : 0
    out.withUnsafeMutableBufferPointer { b in let o = b.baseAddress!
      rows { oy in for ox in 0..<OW {
        let x = (Float(ox) + 0.5) * k, y = (Float(oy) + 0.5) * k
        var c = bg.sample(cx + (x - cx) / zb + sx, cy + (y - cy) / zb + sy)
        c.0 = c.0 * 0.62 + 92; c.1 = c.1 * 0.62 + 92; c.2 = c.2 * 0.62 + 92
        let dx = x - cx, dy = y - cy, r = sqrt(dx * dx + dy * dy)
        // Líneas de velocidad radiales que nacen del punto de impacto.
        if lines > 0 {
          let ang = atan2(dy, dx), w = (sin(floor(ang * 34) * 91.7 + floor(n / 2) * 3.1) * 43758.5).truncatingRemainder(dividingBy: 1)
          if abs(w) > 0.55 { let m = lines * min(1, r / 340) * 0.75; c.0 += (255 - c.0) * m; c.1 += (255 - c.1) * m; c.2 += (255 - c.2) * m }
          let glow = lines * max(0, 1 - r / 520); c.0 += (255 - c.0) * glow; c.1 += (255 - c.1) * glow; c.2 += (255 - c.2) * glow
        }
        var s: (Float, Float, Float, Float) = (0, 0, 0, 0)
        if impact {
          let z = 1 + 0.03 * exp(-n / 8)
          s = hit.rgba(cx + (x - cx) / z + sx, cy + (y - cy) / z + sy)
        } else {
          let z = 1 + 0.015 * tense + 0.5 * rush, N = rush > 0 ? 7 : 1
          let shake = 5 * tense * tense
          for i in 0..<N { let q = 1 + 0.05 * rush * Float(i)
            let t = load.rgba(cx + (x - cx) / z * q + shake * sin(n * 1.3), cy + (y - cy) / (1 + 0.015 * tense) + shake * 0.6 * cos(n * 1.9))
            s.0 += t.0 * t.3; s.1 += t.1 * t.3; s.2 += t.2 * t.3; s.3 += t.3 }
          if s.3 > 0 { s.0 /= s.3; s.1 /= s.3; s.2 /= s.3 }; s.3 /= Float(N)
        }
        if s.3 > 0 { c.0 = c.0 * (1 - s.3) + s.0 * s.3; c.1 = c.1 * (1 - s.3) + s.1 * s.3; c.2 = c.2 * (1 - s.3) + s.2 * s.3 }
        let fl = impact ? max(0, 1 - n / 4) : (n < 44 ? (44 - n) / 4 * 0.8 : rush * rush * 0.9)
        c.0 += (255 - c.0) * fl; c.1 += (255 - c.1) * fl; c.2 += (255 - c.2) * fl
        let i = (oy * OW + ox) * 4
        o[i] = clip(c.0); o[i + 1] = clip(c.1); o[i + 2] = clip(c.2); o[i + 3] = 255
      } }
      if impact { let age = n / 40
        for q in rocks { let d = 150 + (sin(q.ph * 4.7) * 0.5 + 0.5) * 240 + q.v * (1 - pow(1 - age, 2))
          let rx = (cx + cos(q.a) * d) / k, ry = (cy + sin(q.a) * d * 0.7 + 150 * age * age) / k, r = q.s * 1.5 * (1 - age * 0.4)
          let al = max(0, 1 - age * 1.1)
          for py in Int(ry - r)...Int(ry + r) where py >= 0 && py < OH { for px in Int(rx - r)...Int(rx + r) where px >= 0 && px < OW {
            let ca = cos(q.ph + n * 0.3), sa = sin(q.ph + n * 0.3), ux = Float(px) - rx, uy = Float(py) - ry
            let e = (ux * ca + uy * sa) / r, g = (uy * ca - ux * sa) / (r * 0.62); if abs(e) + abs(g) > 1 { continue }
            let i = (py * OW + px) * 4; for c in 0..<3 { o[i + c] = clip(Float(o[i + c]) * (1 - al) + 18 * al) } } }
        } }
    }
  }
}

let a = CommandLine.arguments
switch a[1] { case "mirada": mirada(a[2]); case "cruce": cruce(a[2]); case "golpe": golpe(a[2]); default: exit(2) }
