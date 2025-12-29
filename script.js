const video = document.getElementById("video")
const container = document.getElementById("container")
const btnSpeech = document.getElementById("btn-speech")
const subtitleDiv = document.getElementById("subtitle")
const memeVideo = document.getElementById("meme-video")

// --- Konfigurasi Speech Recognition ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let isMemeCooldown = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'id-ID'; // Bahasa Indonesia
  recognition.continuous = true; // Terus mendengarkan
  recognition.interimResults = true; // Tampilkan hasil sementara

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // Tampilkan teks: Gabungkan final dan interim agar responsif
    const textToShow = (finalTranscript + ' ' + interimTranscript).trim();
    
    if (textToShow) {
      subtitleDiv.innerText = textToShow;
      subtitleDiv.style.display = 'block';
      
      // Cek Trigger Meme
      const lowerText = textToShow.toLowerCase();
      if (!isMemeCooldown && (lowerText.includes("67") || lowerText.includes("enam tujuh") || lowerText.includes("six seven"))) {
         playMeme();
      }

      // Reset timer setiap kali ada input suara baru
      clearTimeout(subtitleDiv.timer);
      
      // Sembunyikan subtitle jika tidak ada suara selama 3 detik
      subtitleDiv.timer = setTimeout(() => {
         if (isRecording) {
            subtitleDiv.style.display = 'none';
         }
      }, 3000);
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    if (event.error === 'not-allowed') {
        alert("Akses mikrofon ditolak. Izinkan akses untuk menggunakan fitur ini.");
        stopRecognition();
    }
  };

  recognition.onend = () => {
    // Jika masih status recording tapi berhenti (misal koneksi putus), mulai lagi
    if (isRecording) {
      try {
          recognition.start();
      } catch (e) {
          console.log("Re-start recognition ignored");
      }
    } else {
      subtitleDiv.style.display = 'none';
    }
  };
} else {
  btnSpeech.style.display = 'none';
  console.warn("Browser tidak mendukung Web Speech API");
}

function startRecognition() {
  if (!recognition) return;
  try {
    recognition.start();
    isRecording = true;
    btnSpeech.innerText = "Stop Speech Recognition";
    btnSpeech.classList.add("recording");
    subtitleDiv.style.display = 'block';
    subtitleDiv.innerText = "Mendengarkan...";
  } catch (err) {
    console.error("Gagal memulai recognition:", err);
  }
}

function stopRecognition() {
  if (!recognition) return;
  isRecording = false;
  recognition.stop();
  btnSpeech.innerText = "Mulai Speech Recognition";
  btnSpeech.classList.remove("recording");
  subtitleDiv.innerText = "";
  subtitleDiv.style.display = 'none';
}

function playMeme() {
  console.log("Meme Triggered!");
  isMemeCooldown = true;
  memeVideo.style.display = "block";
  memeVideo.currentTime = 0; // Mulai dari awal
  memeVideo.play().catch(e => console.error("Gagal memutar video:", e));

  // Restart recognition untuk membersihkan buffer teks "67" agar tidak terpicu ulang
  // isRecording masih true, jadi onend akan otomatis me-start lagi dengan buffer bersih.
  recognition.stop();
}

// Event saat video meme selesai
memeVideo.onended = () => {
  memeVideo.style.display = "none";
  console.log("Meme selesai. Cooldown 10 detik...");
  
  setTimeout(() => {
    isMemeCooldown = false;
    console.log("Meme siap dipicu lagi.");
  }, 10000); // 10 detik
};

btnSpeech.addEventListener("click", () => {
  if (isRecording) {
    stopRecognition();
  } else {
    startRecognition();
  }
});


// --- Kode Face API yang sudah ada ---

// Memuat 3 Model: Deteksi Wajah, Landmarks (Wajib untuk Age/Gender), dan Age/Gender itu sendiri
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'), // Model baru yang kamu butuhkan
  faceapi.nets.ageGenderNet.loadFromUri('/models')
]).then(() => {
  console.log("Semua Model BERHASIL dimuat!");
  startVideo();
}).catch(err => console.error("Gagal memuat model. Pastikan file model Landmarks juga sudah ada!", err));

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream
    })
    .catch(err => console.error("Error webcam:", err))
}

video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video)
  container.append(canvas)
  
  const displaySize = { width: video.width, height: video.height }
  faceapi.matchDimensions(canvas, displaySize)

  setInterval(async () => {
    // Pipeline Deteksi: Detect -> Landmarks -> Age/Gender
    const detections = await faceapi.detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.1 })
    ).withFaceLandmarks(true) // true = gunakan model tiny landmarks
     .withAgeAndGender()

    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (resizedDetections.length > 0) {
      console.log("Wajah terdeteksi!");
      
      // Gambar Kotak Wajah
      faceapi.draw.drawDetections(canvas, resizedDetections)
      
      // (Opsional) Gambar Titik Wajah
      // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

      // Gambar Teks Umur & Gender
      resizedDetections.forEach(result => {
        const { age, gender, genderProbability } = result
        new faceapi.draw.DrawTextField(
          [
            `${Math.round(age)} tahun`,
            `${gender == 'male' ? 'Pria' : 'Wanita'} (${Math.round(genderProbability * 100)}%)`
          ],
          result.detection.box.bottomLeft
        ).draw(canvas)
      })
    }
  }, 200)
})