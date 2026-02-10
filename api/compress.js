const Busboy = require('busboy');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const { PassThrough } = require('stream');

export const config = {
  api: {
    bodyParser: false, // Penting: Matikan default parser untuk handle stream manual
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const busboy = Busboy({ 
    headers: req.headers,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB Limit
    }
  });

  let fileBuffer = [];
  let fileName = '';
  let mimeType = '';
  let fileProcessed = false;

  busboy.on('file', (name, file, info) => {
    const { filename, mimeType: mime } = info;
    fileName = filename;
    mimeType = mime;

    // Validasi tipe file
    if (!['application/pdf', 'application/zip', 'application/x-zip-compressed'].includes(mime)) {
      file.resume(); // Buang stream jika invalid
      return res.status(400).json({ error: 'Hanya file PDF dan ZIP yang didukung.' });
    }

    file.on('data', (data) => {
      fileBuffer.push(data);
    });

    file.on('limit', () => {
      res.status(413).json({ error: 'File melebihi batas maksimum 10MB.' });
    });
  });

  busboy.on('finish', async () => {
    if (!fileName) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
    }

    const fullBuffer = Buffer.concat(fileBuffer);
    fileProcessed = true;

    try {
      if (mimeType === 'application/pdf') {
        // --- LOGIKA KOMPRESI PDF ---
        // Memuat PDF dan menyimpannya kembali (seringkali mengoptimalkan struktur internal)
        const pdfDoc = await PDFDocument.load(fullBuffer);
        // Kita simpan dengan compression options basic
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
        
        const resultBuffer = Buffer.from(pdfBytes);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="compressed_${fileName}"`);
        res.send(resultBuffer);

      } else {
        // --- LOGIKA KOMPRESI ZIP (Re-compress) ---
        // Karena input sudah ZIP, kita akan masukkan ke dalam ZIP baru dengan level kompresi tinggi
        const archive = archiver('zip', {
          zlib: { level: 9 } // Level kompresi maksimal
        });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="compressed_${fileName}"`);

        // Pipe archive langsung ke response
        archive.pipe(res);

        // Tambahkan buffer file asli ke dalam archive baru
        archive.append(fullBuffer, { name: fileName });
        
        await archive.finalize();
      }

    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Gagal memproses file.' });
      }
    }
  });

  // Pipe request ke busboy
  req.pipe(busboy);
}
