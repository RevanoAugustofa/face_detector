const video = document.getElementById("video")
const container = document.getElementById("container")

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
