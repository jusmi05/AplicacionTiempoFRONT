$(function () {
    $(document).tooltip();
});

// Inicializar la lista de ciudades seleccionadas desde el localStorage
let selectedCities = JSON.parse(localStorage.getItem("selectedCities")) || [];
let selectedFields = JSON.parse(localStorage.getItem("selectedFields")) || ["temperatura", "humedad"];

// Definir los iconos de los marcadores
const defaultIcon = L.icon({
    iconUrl: "fotos/default.png",
    iconSize: [40, 40],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const selectedIcon = L.icon({
    iconUrl: "fotos/selected.png",
    iconSize: [40, 40],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

// Mostrar el mapa al cargar la página
document.getElementById("map").style.display = "block";
document.getElementById("details").style.display = "none";

// Mostrar el botón "Aceptar" si hay ciudades seleccionadas
const acceptButton = document.getElementById("accept-button");
acceptButton.style.display = selectedCities.length > 0 ? "block" : "none";

// Función para inicializar el mapa y cargar las estaciones
function initializeMap() {
    fetch("http://localhost:81/api/estaciones/")
        .then((response) => response.json())
        .then((estaciones) => {
            const map = L.map("map").setView([43.17416597, -2.306332108], 10);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "© OpenStreetMap contributors",
            }).addTo(map);

            estaciones.forEach((estacion) => {
                const marker = L.marker([estacion.latitud, estacion.longitud], {
                    icon: selectedCities.includes(estacion.municipio) ? selectedIcon : defaultIcon,
                }).addTo(map);

                marker.bindPopup(`<b>${estacion.municipio}</b>`);

                marker.on("click", () => {
                    toggleCitySelection(estacion.municipio, marker);
                });
            });


            createAcceptButton();
        })
        .catch((error) => console.error("Error al cargar las estaciones:", error));
}

function toggleCitySelection(city, marker) {
    if (selectedCities.includes(city)) {
        selectedCities = selectedCities.filter((c) => c !== city);
        marker.setIcon(defaultIcon);
    } else {
        selectedCities.push(city);
        marker.setIcon(selectedIcon);
    }

    localStorage.setItem("selectedCities", JSON.stringify(selectedCities));
    acceptButton.style.display = selectedCities.length > 0 ? "block" : "none";
}

function createAcceptButton() {
    acceptButton.style.position = "fixed";
    acceptButton.style.bottom = "20px";
    acceptButton.style.left = "50%";
    acceptButton.style.transform = "translateX(-50%)";
    acceptButton.style.display = selectedCities.length > 0 ? "block" : "none";

    acceptButton.addEventListener("click", showDetails);
}

function showDetails() {
    document.getElementById("map").style.display = "none";
    document.getElementById("details").style.display = "block";

    // Cambiar el fondo a gradiente
    document.body.style.backgroundColor = "#FF8800";

    updateWeatherCards();
    acceptButton.style.display = "none";
}
// Función para actualizar las tarjetas de clima con los datos seleccionados
function updateWeatherCards() {
    const cityDetails = document.getElementById("city-details");
    cityDetails.innerHTML = ""; // Limpiar contenido anterior

    selectedCities.forEach((city) => {
        fetch(`http://localhost:81/api/mediciones/${city}`)
            .then((response) => response.json())
            .then(async (data) => {
                let descripcion = await getWeatherDescription(city);
                let weatherCard = `<div class="weather-card" 
                                    onmouseover="showForecast('${city}')"
                                    onmouseleave="hideForecast('${city}')"
                                    onclick="showDatePickerForm('${city}')">`;

                // Primer div: Nombre de la ciudad, temperatura y humedad
                weatherCard += `
                    <div class="basic-info">
                        <h3  title="${descripcion}" >${city}</h3>
                        <p class="temperatura">${data.temperatura !== undefined ? data.temperatura : 'No disponible'}°C</p>
                        <p class="humedad">${data.humedad !== undefined ? data.humedad : 'No disponible'}%</p>
                    </div>
                `;

                // Solo mostrar additional-info si hay campos seleccionados
                if (selectedFields.length > 0) {
                    // Segundo div: Opciones seleccionadas (sin fecha)
                    weatherCard += `<div class="additional-info">`;

                    // Mostrar solo los campos seleccionados y no vacíos
                    selectedFields.forEach((field) => {
                        if (data[field] !== undefined && field !== "temperatura" && field !== "humedad") {
                            weatherCard += `<p class="${capitalize(field)}">${data[field]}</p>`;
                        }
                    });

                    weatherCard += `</div>`; // Cerrar additional-info solo si hay contenido
                }

                // Tercer div: Previsión del clima (se llenará dinámicamente)
                weatherCard += `<div class="forecast" id="forecast-${city}" style="display:none;">`;
                weatherCard += `<ul id="forecast-list-${city}"></ul>`;
                weatherCard += `</div>`; // Cerrar forecast

                // Agregar el pronóstico a la tarjeta
                cityDetails.innerHTML += weatherCard;

                // Llamar a la API de OpenWeather para obtener la previsión real
                fetchWeatherForecast(city);
            })
            .catch((error) => console.error(`Error al obtener el clima de ${city}:`, error));
    });
}

// Mostrar el formulario de selección de fechas
function showDatePickerForm(city) {
    // Mostrar el formulario y ocultar el mapa
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('date-picker-div').style.display = 'block';
    document.getElementById('map').style.display = 'none';

    // Guardar la ciudad seleccionada para usarla más tarde
    selectedCityForGraph = city;
}

// Función para obtener la previsión del clima de OpenWeather
function fetchWeatherForecast(city) {
    fetch(`http://localhost:81/api/mediciones/pronostico/${city}`)
        .then((response) => response.json())
        .then((data) => {
            const forecastList = document.getElementById(`forecast-list-${city}`);
            forecastList.innerHTML = "";

            if (data.list && data.list.length > 0) {
                for (let i = 0; i < data.list.length; i++) {
                    const forecast = data.list[i]; // Tomar cada pronóstico del JSON
                    const date = new Date(forecast.dt * 1000);
                    const temp = forecast.main.temp;
                    const weatherMain = forecast.weather[0].main; // Estado del tiempo (Ej: "Clear", "Rain")

                    // Obtener la imagen correspondiente según el estado del clima
                    const weatherIcon = getWeatherIcon(weatherMain);
                    forecastList.innerHTML += `
                        <li>
                            ${temp}°C 
                            <img src="fotos/${weatherIcon}" alt="${weatherMain}" />
                        </li>`;
                }
            } else {
                forecastList.innerHTML = "<li>No disponible</li>";
            }
        })
        .catch((error) => console.error(`Error al obtener la previsión de ${city}:`, error));
}

// Función para obtener la imagen correspondiente al estado del clima
function getWeatherIcon(weatherMain) {
    let icon = "default.png"; // Imagen por defecto

    switch (weatherMain.toLowerCase()) {
        case "clear":
            icon = "clear.png";
            break;
        case "clouds":
            icon = "clouds.png";
            break;
        case "rain":
            icon = "rain.png";
            break;
        case "snow":
            icon = "snow.png";
            break;
        case "thunderstorm":
            icon = "thunderstorm.png";
            break;
        case "drizzle":
            icon = "drizzle.png";
            break;
        // Agregar más casos según los tipos de clima que quieras manejar
        default:
            icon = "default.png";
    }

    return icon;
}

// Función que combina la obtención de la previsión y la descripción del pronóstico
function showForecast(city) {
    const forecast = document.getElementById(`forecast-${city}`);
    if (forecast) {
        forecast.style.display = "block"; // Mostrar la previsión
        fetchWeatherForecast(city); // Llamar a la función para obtener la previsión
    }
}

// Función para ocultar la previsión al quitar el mouse
function hideForecast(city) {
    const forecastDiv = document.getElementById(`forecast-${city}`);
    if (forecastDiv) {
        forecastDiv.style.display = "none";
    }
}

// Capitalizar la primera letra de los campos de datos
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace("_", " ");
}

// Función para actualizar las tarjetas cada minuto
setInterval(updateWeatherCards, 60000);

// Botón para volver al mapa
document.getElementById("back-button").addEventListener("click", () => {
    document.getElementById("map").style.display = "block";
    document.getElementById("details").style.display = "none";

    // Cambiar el fondo a blanco cuando se vuelve al mapa
    document.body.style.backgroundColor = "white";

    selectedCities = JSON.parse(localStorage.getItem("selectedCities")) || [];
    acceptButton.style.display = selectedCities.length > 0 ? "block" : "none";
});

// Botón de opciones
document.getElementById("options-button").addEventListener("click", () => {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("options-menu").style.display = "block";
});

// Función para cerrar el menú de opciones
function closeOptions() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("options-menu").style.display = "none";
}
document.addEventListener('DOMContentLoaded', () => {
    const datePickerDiv = document.getElementById('date-picker-div');
    const overlay = document.getElementById('overlay'); // Asegúrate de que este también esté definido

});

function cancelForm() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("date-picker-div").style.display = "none";
}

document.getElementById('get-weather-btn').addEventListener('click', function () {
    // Obtener las fechas seleccionadas
    const city = selectedCityForGraph;
    const start_date = document.getElementById('start_date').value;
    const end_date = document.getElementById('end_date').value;

    // Comprobar que las fechas están bien definidas
    if (!start_date || !end_date) {
        alert("Por favor, selecciona ambas fechas.");
        return;
    } else if (start_date > end_date) {
        alert("La fecha de inicio debe ser anterior a la fecha de fin.");
        return;
    }

    // Realizar la llamada a la API con las fechas
    const url = `http://localhost:81/api/mediciones/weather-history/${city}/${start_date}/${end_date}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Extraer las temperaturas y las fechas para el gráfico
            const labels = data.map(item => item.fecha_hora);
            const temperatures = data.map(item => item.temperatura);
            const humidities = data.map(item => item.humedad);

            // Obtener los contenedores
            const datePickerDiv = document.getElementById('date-picker-div');
            const chartContainer = document.getElementById('chart-container');
            const formContainer = document.getElementById('form-container');

            // Ocultar el formulario y mostrar el contenedor del gráfico
            formContainer.style.display = 'none';
            chartContainer.style.display = 'block';

            // Eliminar cualquier gráfico anterior si existe
            if (window.weatherChart) {
                window.weatherChart.destroy();
            }

            // Crear un nuevo canvas para el gráfico
            const canvas = document.createElement('canvas');
            canvas.id = 'weather-chart';
            chartContainer.appendChild(canvas);

            // Agregar botón de cerrar
            const closeButton = document.createElement('button');
            closeButton.innerText = 'Cerrar';
            closeButton.id = 'close-btn';
            closeButton.addEventListener('click', function () {
                // Eliminar el gráfico al cerrar
                if (window.weatherChart) {
                    window.weatherChart.destroy();
                    window.weatherChart = null;
                }

                // Eliminar el canvas del contenedor
                const canvas = document.getElementById('weather-chart');
                if (canvas) {
                    canvas.remove(); // Elimina el canvas
                }

                if (closeButton) {
                    closeButton.remove(); // Elimina el botón de cerrar
                }

                // Ocultar el contenedor del gráfico y mostrar el formulario nuevamente
                chartContainer.style.display = 'none';
                formContainer.style.display = 'block';

                // Ocultar el overlay y el date-picker-div
                overlay.style.display = 'none';
                datePickerDiv.style.display = 'none';
            });
            chartContainer.appendChild(closeButton);

            // Crear el gráfico con Chart.js
            const ctx = canvas.getContext('2d');
            window.weatherChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Temperatura',
                        data: temperatures,
                        borderColor: '#FF8C42',
                        borderWidth: 1,
                        fill: false,
                        yAxisID: 'y1'  // Asocia este dataset al primer eje Y
                    }, {
                        label: 'Humedad',
                        data: humidities,
                        borderColor: '#1E88E5',
                        borderWidth: 1,
                        fill: false,
                        yAxisID: 'y2'  // Asocia este dataset al segundo eje Y
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            }
                        },
                        y1: {  // Primer eje Y (Temperatura)
                            type: 'linear',
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Temperatura (°C)'  // Título para el eje Y izquierdo
                            }
                        },
                        y2: {  // Segundo eje Y (Humedad)
                            type: 'linear',
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Humedad (%)'  // Título para el eje Y derecho
                            },
                            grid: {
                                drawOnChartArea: false,  // No dibujar la cuadrícula en el área del gráfico para este eje
                            }
                        }
                    }
                }
            });


        })
        .catch(error => {
            console.error("Error al obtener los datos:", error);
            alert("Hubo un problema al cargar los datos.");
        });
});

async function getWeatherDescription(city) {
    // Diccionarios de nombres de ciudad y regiones para el endpoint
    const cityNames = {
        "Irun": "irun",
        "Donostia": "donostia",
        "Vitoria-Gasteiz": "gasteiz",
        "Bilbao": "bilbao",
        "Errenteria": "errenteria"
    };

    const regionsZones = {
        "bilbao": "great_bilbao",
        "irun": "coast_zone",
        "gasteiz": "vitoria_gasteiz",
        "donostia": "donostialdea",
        "errenteria": "donostialdea",
    };

    // Se obtiene la localización y región según la ciudad
    const localizacion = cityNames[city] || null;
    const region = regionsZones[localizacion] || null;

    // Si no se encuentra la localización o región, se avisa y retorna un mensaje
    if (!region || !localizacion) {
        console.warn("Región o localización no encontrada", localizacion);
        return "Región o localización no encontrada";
    }

    // Se construye la fecha y URI para el endpoint de Euskalmet
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate() + 1).padStart(2, "0");
    const formattedDate = `${year}${month}${day}`;

    // Endpoint final
    const endpoint = `https://api.euskadi.eus/euskalmet/weather/regions/basque_country/zones/${region}/locations/${localizacion}/forecast/at/${year}/${month}/${day - 1}/for/${formattedDate}`;
    // Token de acceso a la API
    const token = "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJtZXQwMS5hcGlrZXkiLCJpc3MiOiJJRVMgUExBSUFVTkRJIEJISSBJUlVOIiwiZXhwIjoyMjM4MTMxMDAyLCJ2ZXJzaW9uIjoiMS4wLjAiLCJpYXQiOjE3MzM5ODgyMTAsImVtYWlsIjoiaWtjdGhAcGxhaWF1bmRpLm5ldCJ9.cBnRq14eqFnOTyh5FE8EitSdlleDhdlEZOTE7Hgrk6os3YyCuueP4kT8Bs0P60HJA7U9yhL9nSIPNkcAJKxZKN_UveP8Fc4w2L3DP0ZnEGhkl31b7nmJj_4V5Z2IyhwCqCEypt-gJ39isX4iqM0aYEBsaWJyUY3Hk-JD9l2HOIyHwfa2h5XLso9LxbppzA-2qlO3bx1WWFqRLjRzGaa-nONdOM32V-dq9LwrG3rXDX8zVV5vzT1VEqoveI6uPabzMx9BLyLQmrVJXASRQ-kwrBCKkXH3YNA_1PG8gKTEvFJ5P5SWbwhDyixvFVrDNgNji77IInvr6qByEuwFHfQJCQ";

    try {
        // Se realiza la petición GET a Euskalmet
        const response = await fetch(endpoint, {
            headers: {
                Authorization: token,
                "Content-Type": "application/json; charset=utf-8",
            },
        });

        // Manejo de respuesta no OK
        if (!response.ok) {
            throw new Error("Error al obtener los datos del endpoint externo");
        }

        // Se obtiene el blob (posible ISO-8859-1)
        const blob = await response.blob();

        // Se convierte el blob a texto con la codificación adecuada
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            // Se especifica la codificación para leer el blob
            reader.readAsText(blob, "ISO-8859-1");
            reader.onload = function () {
                try {
                    // Una vez leído, se intenta parsear el contenido como JSON
                    const json = JSON.parse(reader.result);
                    // console.log(json.forecastText.SPANISH, endpoint);
                    // Si el parseo es exitoso, se resuelve la promesa con el texto en español
                    resolve(json.forecastText.SPANISH);
                } catch (error) {
                    // Manejo de error de parseo
                    console.error("Error parseando JSON:", error);
                    reject("No se pudo convertir la respuesta en JSON.");
                }
            };
            // Manejo de error de lectura del blob
            reader.onerror = function () {
                reject("Error leyendo el blob.");
            };
        });
    } catch (error) {
        // Manejo de errores en comunicación con la API externa
        console.error("Error al obtener los datos del endpoint de OPEN DATA EUSKADI:", error);
        return "Error al obtener la previsión del tiempo.";
    }
}

// ---------------- FUNCIONALIDAD DE DRAG & DROP ----------------
function initializeDragAndDrop() {
    const availableOptions = document.getElementById("available-options");
    const selectedOptions = document.getElementById("selected-options");

    // Hacer que solo las opciones en "Opciones disponibles" sean arrastrables
    document.querySelectorAll(".draggable[draggable='true']").forEach((option) => {
        option.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text", event.target.getAttribute("data-field"));
            document.getElementById("available-options").style.border = "2px dashed #FF8800";
            document.getElementById("selected-options").style.border = "2px dashed #FF8800";
        });
    });

    [availableOptions, selectedOptions].forEach((dropZone) => {
        dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropZone.classList.add("drag-over");
            document.getElementById("available-options").style.border = "2px dashed #FF8800";
            document.getElementById("selected-options").style.border = "2px dashed #FF8800";
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-over");
            document.getElementById("available-options").style.border = "2px dashed #FF8800";
            document.getElementById("selected-options").style.border = "2px dashed #FF8800";
        });

        dropZone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
            document.getElementById("available-options").style.border = "0px dashed #FF8800";
            document.getElementById("selected-options").style.border = "0px dashed #FF8800";

            const field = event.dataTransfer.getData("text");

            if (dropZone === selectedOptions && !selectedFields.includes(field)) {
                // Si estamos soltando en "selectedOptions", agregar el campo
                selectedFields.push(field);
            } else if (dropZone === availableOptions) {
                // Si estamos soltando en "availableOptions", eliminar el campo de "selectedFields"
                selectedFields = selectedFields.filter((item) => item !== field);
            }

            // Actualizamos el localStorage con los campos seleccionados
            localStorage.setItem("selectedFields", JSON.stringify(selectedFields));
            updateOptionsDisplay();  // Actualizamos la interfaz
            updateWeatherCards();    // Actualizamos las tarjetas del clima con los nuevos datos
        });
    });

    updateOptionsDisplay();  // Llamamos a la función para actualizar la vista al cargar la página
}

function updateOptionsDisplay() {
    const availableOptions = document.getElementById("available-options");
    const selectedOptions = document.getElementById("selected-options");

    const allOptions = {
        presion: "Presión",
        viento_velocidad: "Velocidad del viento",
        viento_direccion: "Dirección del viento",
        nubosidad: "Nubosidad"
    };

    availableOptions.innerHTML = "";  // Limpiamos la zona de opciones disponibles
    selectedOptions.innerHTML = "";  // Limpiamos la zona de datos seleccionados

    // Primero agregamos las opciones seleccionadas (Temperatura y Humedad no arrastrables)
    selectedFields.forEach((key) => {
        if (key === "temperatura" || key === "humedad") {
            // Para "Temperatura" y "Humedad", no serán arrastrables
            const element = document.createElement("div");
            element.classList.add("draggable");
            element.setAttribute("draggable", "false");  // Deshabilitamos arrastrar
            element.setAttribute("data-field", key);
            element.textContent = capitalize(key);
            selectedOptions.appendChild(element);
        }
    });

    // Luego agregamos las opciones disponibles que no están en "selectedFields"
    Object.entries(allOptions).forEach(([key, label]) => {
        const element = document.createElement("div");
        element.classList.add("draggable");
        element.setAttribute("draggable", "true");  // Permitir arrastrar solo estas opciones
        element.setAttribute("data-field", key);
        element.textContent = label;

        // Evento de dragstart para arrastrar un elemento
        element.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text", key);
        });

        // Si la opción está en los campos seleccionados, la agregamos a "selectedOptions"
        if (selectedFields.includes(key)) {
            selectedOptions.appendChild(element);
        } else {
            availableOptions.appendChild(element);  // Si no, la agregamos a "availableOptions"
        }
    });
}

// Iniciar el mapa y drag & drop al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    initializeMap();
    initializeDragAndDrop();
});
