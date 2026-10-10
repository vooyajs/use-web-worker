use vooya as voo;

#[derive(Clone, PartialEq, voo::ToJs)]
pub struct FieldSnapshot {
    pub pixels: Vec<u8>,
    pub checksum: u32,
}

#[derive(Default)]
pub struct Field {
    pixels: Vec<u8>,
    checksum: u32,
}

#[voo::store]
impl Field {
    #[voo::action]
    pub fn render(&mut self, seed: u32) {
        let width = 640;
        let height = 420;
        self.pixels = vec![0; width * height * 4];
        self.checksum = 0;
        let angle = (seed % 12) as f64 * 0.035;
        for y in 0..height {
            for x in 0..width {
                let mut zx = (x as f64 / width as f64 - 0.5) * 3.3;
                let mut zy = (y as f64 / height as f64 - 0.5) * 2.2;
                let mut n = 0;
                while zx * zx + zy * zy < 256.0 && n < 180 {
                    let next = zx * zx - zy * zy - 0.745 + angle;
                    zy = 2.0 * zx * zy + 0.186;
                    zx = next;
                    n += 1;
                }
                let t = if n == 180 { 0.0 } else { (n as f64 / 180.0).sqrt() };
                let i = (y * width + x) * 4;
                self.pixels[i] = (10.0 + 200.0 * t.powf(1.6)) as u8;
                self.pixels[i + 1] = (17.0 + 215.0 * t) as u8;
                self.pixels[i + 2] = (26.0 + 225.0 * t.sqrt()) as u8;
                self.pixels[i + 3] = 255;
                self.checksum = self.checksum.wrapping_add(n);
            }
        }
    }

    #[voo::snapshot]
    pub fn snapshot(&self) -> FieldSnapshot {
        FieldSnapshot { pixels: self.pixels.clone(), checksum: self.checksum }
    }
}
