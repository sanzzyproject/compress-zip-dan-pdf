document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const actionBtn = document.getElementById('action-btn');
    const statusText = document.getElementById('status-text');
    const fileInfo = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const loader = document.getElementById('loader');

    let currentFile = null;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    // Trigger input file saat klik card
    dropZone.addEventListener('click', (e) => {
        if(e.target !== actionBtn) fileInput.click();
    });

    // Drag & Drop Effects
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Handle File Drop
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // Handle Input Change
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            validateAndSetFile(file);
        }
    }

    function validateAndSetFile(file) {
        // Validasi Tipe
        const validTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed'];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.zip') && !file.name.endsWith('.pdf')) {
            alert('Hanya file PDF dan ZIP yang diperbolehkan!');
            return;
        }

        // Validasi Ukuran
        if (file.size > MAX_SIZE) {
            alert('File terlalu besar! Maksimal 10MB.');
            return;
        }

        currentFile = file;
        updateUIState(true);
    }

    function updateUIState(isFileSelected) {
        if (isFileSelected) {
            statusText.textContent = "File siap diproses";
            fileNameDisplay.textContent = currentFile.name;
            fileSizeDisplay.textContent = `(${(currentFile.size / 1024 / 1024).toFixed(2)} MB)`;
            fileInfo.classList.add('active');
            actionBtn.textContent = "Compress Sekarang";
            actionBtn.disabled = false;
        } else {
            // Reset state
        }
    }

    // Upload & Compress Logic
    actionBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Mencegah klik dropZone
        
        if (!currentFile) return;

        // UI Loading State
        actionBtn.disabled = true;
        actionBtn.style.display = 'none';
        loader.classList.add('active');
        statusText.textContent = "Mengunggah & Mengompres...";

        const formData = new FormData();
        formData.append('file', currentFile);

        try {
            const response = await fetch('/api/compress', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memproses file');
            }

            // Handle Download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // Ambil nama file dari header jika ada, atau generate default
            const contentDisposition = response.headers.get('Content-Disposition');
            let downloadName = `compressed_${currentFile.name}`;
            if (contentDisposition) {
                 const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                 if (fileNameMatch.length === 2) downloadName = fileNameMatch[1];
            }

            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            statusText.textContent = "Selesai! File terunduh.";

        } catch (error) {
            console.error(error);
            statusText.textContent = "Error: " + error.message;
            alert(error.message);
        } finally {
            // Reset UI setelah delay
            setTimeout(() => {
                loader.classList.remove('active');
                actionBtn.style.display = 'block';
                actionBtn.textContent = "Pilih File Lain";
                actionBtn.disabled = false;
            }, 2000);
        }
    });
});
