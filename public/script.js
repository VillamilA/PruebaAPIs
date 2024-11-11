let labeledFaceDescriptors;
let modelsLoaded = false;
let audio = new Audio('/uploads/level-up-191997.mp3'); // Ruta correcta al archivo de sonido

// Cargar modelos de Face API
async function loadModels() {
    const MODEL_URL = '/models';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log("Modelos cargados");
}

// Cargar imágenes etiquetadas (usuarios registrados con sus fotos)
async function loadLabeledImages() {
    try {
        const labels = await fetch(`/get-labels`).then(res => res.json());
        return Promise.all(
            labels.map(async label => {
                const descriptions = [];
                const response = await fetch(`/get-image?name=${label}`);
                const blob = await response.blob();
                const img = await faceapi.bufferToImage(blob);
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                if (detections && detections.descriptor) {
                    descriptions.push(detections.descriptor);
                }
                return new faceapi.LabeledFaceDescriptors(label, descriptions);
            })
        );
    } catch (error) {
        console.error("Error al cargar etiquetas de usuarios:", error);
        throw error;
    }
}

function getCharacters() {
    const results = fetch("https://rickandmortyapi.com/api/character");
    results
        .then(response => response.json())
        .then(data => {
            const main = document.getElementById("characters-container");
            main.innerHTML = ''; // Limpiar contenido anterior
            data.results.forEach(personaje => {
                const article = document.createRange().createContextualFragment(/*html*/`
                    <article class="card m-2" style="width: 200px;">
                        <div class="image-container">
                            <img src="${personaje.image}" alt="${personaje.name}" class="card-img-top">
                        </div>
                        <div class="card-body text-center">
                            <h5 class="card-title">${personaje.name}</h5>
                            <span class="badge bg-info">${personaje.status}</span>
                        </div>
                    </article>
                `);
                main.appendChild(article);
            });
            // Mostrar la sección de personajes
            document.getElementById('characters-section').style.display = 'block';
        })
        .catch(error => console.error("Error al obtener personajes:", error));
}

// Modificar la función de inicio de sesión manual
document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const name = document.getElementById('login-name').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
        const response = await fetch(`/verify-login?name=${name}&password=${password}`);
        const userExistsResponse = await response.json();

        if (userExistsResponse.exists) {
            showToast('Inicio de sesión', 'Bienvenido al sistema', 'success');
            console.log("Inicio de sesión exitoso.");
            getCharacters(); // Mostrar personajes al iniciar sesión correctamente
        } else {
            showToast('Error', 'Usuario o contraseña incorrectos', 'error');
            console.log("Error: Usuario o contraseña incorrectos.");
        }
    } catch (error) {
        showToast('Error', 'Error verificando el login', 'error');
        console.log("Error verificando el login:", error);
    }
});


// Iniciar la cámara y el reconocimiento facial
async function startCamera() {
    if (!modelsLoaded) {
        console.error("Los modelos no se han cargado aún.");
        return;
    }

    const video = document.getElementById('video');
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(function(stream) {
                video.srcObject = stream;
                video.play();
                console.log("Cámara activada");
            })
            .catch(function(error) {
                console.error("Error al activar la cámara: ", error);
            });
    } else {
        console.error("getUserMedia no es soportado en este navegador.");
    }

    video.addEventListener('loadeddata', async () => {
        const existingCanvas = document.querySelector('#camera canvas');
        if (existingCanvas) {
            existingCanvas.remove(); // Eliminar el canvas anterior para evitar duplicados
        }

        const canvas = faceapi.createCanvasFromMedia(video);
        canvas.style.position = 'absolute';
        canvas.style.top = '0px';
        canvas.style.left = '0px';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        document.getElementById('camera').appendChild(canvas);

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const detections = await faceapi.detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors();
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); // Limpiar el canvas antes de redibujar
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

            if (labeledFaceDescriptors) {
                const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
                const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

                for (let result of results) {
                    const box = resizedDetections[results.indexOf(result)].detection.box;
                    const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString(), boxColor: result.label === 'unknown' ? 'red' : 'green' });
                    drawBox.draw(canvas);

                    if (result.label !== 'unknown' && result.distance < 0.6) {
                        const userId = await getUserIdByName(result.label);
                        if (userId) {
                            showToast('Error', 'usuario no registrado', 'error');
                        } else {
                            showToast('Inicio de sesión', 'Bienvenido al sistema', 'success');
                            getCharacters(); 
                        }
                    }
                }
            }
        }, 5000);
    });
}

// Obtener el ID del usuario por nombre
async function getUserIdByName(name) {
    const response = await fetch(`/get-user-id?name=${name}`);
    if (response.ok) {
        const data = await response.json();
        return data.id;
    }
    return null;
}

// Función para iniciar el reconocimiento facial
async function startFacialLogin() {
    try {
        // Verificar si los modelos están cargados
        if (!modelsLoaded) {
            await loadModels(); // Cargar modelos si no están cargados
        }

        // Cargar imágenes etiquetadas (usuarios registrados con sus fotos)
        if (!labeledFaceDescriptors) {
            labeledFaceDescriptors = await loadLabeledImages();
        }

        // Iniciar la cámara y reconocimiento facial
        startCamera();
    } catch (error) {
        console.error("Error iniciando el reconocimiento facial:", error);
        showToast('Error', 'Hubo un problema al iniciar el reconocimiento facial', 'error');
    }
}

// Asegurarse de que el DOM esté completamente cargado antes de añadir el evento
document.addEventListener("DOMContentLoaded", function() {
    const facialLoginButton = document.getElementById('start-camera');

    if (facialLoginButton) {
        facialLoginButton.addEventListener('click', startFacialLogin);
    } else {
        console.error("El botón 'Iniciar Reconocimiento Facial' no se encontró.");
    }
});

// Password validation function
function validatePasswords() {
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirm-password').value.trim();
    
    if (password !== confirmPassword) {
        showToast('Error', 'Las contraseñas no coinciden', 'error');
        console.log("Error: Las contraseñas no coinciden.");
        document.getElementById('submit-button').disabled = true;
        return false;
    } else {
        document.getElementById('submit-button').disabled = false;
        return true;
    }
}

// Validación al perder el foco en el campo de confirmación de contraseña
document.getElementById('confirm-password').addEventListener('blur', validatePasswords);

// Complete validation and data submission
document.getElementById('user-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;

    const name = document.getElementById('name').value.trim();
    const password = document.getElementById('password').value.trim();
    const photo = document.getElementById('photo').files[0];

    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('password', password);
        formData.append('photo', photo);

        await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        showToast('Éxito', 'Usuario agregado exitosamente', 'success');
        document.getElementById('user-form').reset();
    } catch (error) {
        console.error("Error:", error);
        showToast('Success', 'User added successfully', 'success');
    } finally {
        submitButton.disabled = false;
    }
});

// Function to show toasts
function showToast(title, message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    const toastEl = document.getElementById('liveToast');
    
    // Centrar el contenedor de toasts
    toastContainer.style.left = '50%';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.bottom = '20px';
    
    const toast = new bootstrap.Toast(toastEl);
    
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    
    // Remover clases de color previas
    toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');
    
    // Siempre añadir la clase de éxito
    toastEl.classList.add('bg-success', 'text-white');
    
    toast.show();
}
