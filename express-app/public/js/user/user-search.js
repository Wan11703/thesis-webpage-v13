// search bar

const searchWrapper = document.querySelector(".search-bar");
const inputBox = searchWrapper.querySelector("input");
const drug_list = searchWrapper.querySelector(".drug-list");

inputBox.onkeyup = (e) => {
    let userData = e.target.value;
    let emptyArray = [];
    if (userData) {
        emptyArray = auto_complete.filter((data) => {
            return data.toLocaleLowerCase().startsWith(userData.toLocaleLowerCase());
        });
        emptyArray = emptyArray.map((data) => {
            return data = `<li>${data}</li>`;
        });
        searchWrapper.classList.add("active");
        showDrugList(emptyArray);

        let allList = drug_list.querySelectorAll("li");
        for (let i = 0; i < allList.length; i++) {
            allList[i].setAttribute("onclick", "select(this)");
        }
    }
    else {
        searchWrapper.classList.remove("active");
    }
}

function select(element) {
    let selectedUserData = element.textContent;
    inputBox.value = selectedUserData;
    searchWrapper.classList.remove("active");
}

function showDrugList(list) {
    let listData;
    if (!list.length) {
        userValue = inputBox.value;
        listData = `<li>${userValue}</li>`;
    }
    else {
        listData = list.join('');
    }

    drug_list.innerHTML = listData;
}

// modal

const open = document.getElementById("open");
const modal_container = document.getElementById("modal_container");
const close = document.getElementById("close");
const modalTitle = document.querySelector("#modal-title");

const tabActive = document.querySelector(".tabs");
const loaderActive = document.querySelector(".loader");

let loading;


// modal


const drug_information = document.querySelector("#drug_information");
const interaction = document.querySelector("#interactions");
const dosage = document.querySelector("#indications");
const side_effects = document.querySelector("#side_effects");
const price = document.querySelector("#price");




open.addEventListener('click', () => {
    const drugName = inputBox.value; // Get the search query from the input box
    modalTitle.textContent = "You searched for: " + inputBox.value;
    modal_container.classList.add('show');


    // Reset progress bar and start animation
    count = 0;
    per = 0;
    progress.style.width = "0px"; // Reset progress bar width
    loading = setInterval(animate, 150); // Start the animation

    // Send the drug name to the backend
    fetch('http://localhost:5000/get-drug-info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ drug_name: drugName }), // Send the drug name as JSON
    })
        .then(response => response.json())
        .then(data => {
            // Update modal content with the response from the backend
            if (data.error) {
                drug_information.textContent = "";
                interaction.textContent = "";
                dosage.textContent = "";
                side_effects.textContent = "";
                price.textContent = "";
            } else {
                drug_information.textContent = data.drug_information || "No details available.";
                interaction.textContent = data.interaction || "No interactions available.";
                dosage.textContent = data.dosage || "No indications available.";
                side_effects.textContent = data.side_effects || "No side effects available.";
                price.textContent = data.price || "No side effects available.";
            }
        })
        .catch(error => {
            console.error('Error:', error);
            drug_information.textContent = "Error fetching drug information.";
        });
});

close.addEventListener('click', () => {
    modal_container.classList.remove('show');

    // Stop and reset the animation
    clearInterval(loading); // Stop the interval
    count = 0;
    per = 0;
    progress.style.width = "0px"; // Reset progress bar width

    loaderActive.classList.add("active");
    tabActive.classList.remove("active");
});

// progress bar

var progress = document.querySelector(".progress");
var text = document.querySelector(".text");

var count = 0; // Start at 0%
var per = 0;   // Start at 0px

// var loading = setInterval(animate, 50);

function animate() {
    if ((count == 100) & (per == 600)) {
        text.classList.remove("text-blink");
        loaderActive.classList.remove("active");
        tabActive.classList.add("active");
    } else {
        text.classList.add("text-blink");
        per = per + 6;
        count = count + 1;
        progress.style.width = per + "px";
    }
}

// OpenAI API integration for summarizing fields

async function summarizeField(fieldText, fieldType) {
    try {
        const response = await fetch('http://localhost:5000/summarize-field', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ field_text: fieldText, field_type: fieldType }),
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data.summary;
    } catch (error) {
        console.error('Error:', error);
        return "Error summarizing field.";
    }
}

// Example usage of summarizeField function
/* (async () => {
    const summary = await summarizeField("Aspirin is used to reduce pain, fever, or inflammation.", "description");
    console.log(summary);
})(); */

function toggleDropdown(event) {
    event.stopPropagation();
    document.querySelector(".user-menu .dropdown").classList.toggle("active");
}

// Close dropdown if clicking outside
document.addEventListener("click", () => {
    document.querySelector(".user-menu .dropdown").classList.remove("active");
});

// logout

// Elements
const logoutLinks = document.querySelectorAll(".logout-confirm"); // 🔹 this is your trigger element (replace with your logout button/link class)
const logoutModal = document.querySelector(".logout-modal-container");
const logoutCloseBtn = document.getElementById("logout-close-btn");
const logoutCancelBtn = document.getElementById("logout-cancel-btn");
const logoutConfirmBtn = document.getElementById("logout-confirm-btn");

// Open modal
logoutLinks.forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault(); // prevent jumping to top
        logoutModal.classList.add("active");
    });
});

// Close modal (X button)
logoutCloseBtn.addEventListener("click", () => {
    logoutModal.classList.remove("active");
});

// Close modal (Cancel button)
logoutCancelBtn.addEventListener("click", () => {
    logoutModal.classList.remove("active");
});

// Confirm logout
logoutConfirmBtn.addEventListener("click", () => {
    window.location.href = "/logout";
});

let serverMessageTimeout = null;

function showServerMessage(message, type = "success") {
    const serverMessage = document.getElementById("server-message");
    const messageText = document.getElementById("server-message-text");
    const messageIcon = document.getElementById("server-message-icon");

    // Reset classes
    serverMessage.classList.remove("success", "error");

    // Set text
    messageText.textContent = message;

    // Apply type + icon
    if (type === "success") {
        serverMessage.classList.add("success");
        messageIcon.src = "/images/icons/seal-check-green.svg";
    } else if (type === "error") {
        serverMessage.classList.add("error");
        messageIcon.src = "/images/icons/seal-warning-red.svg";
    }

    // Show with animation
    serverMessage.classList.remove("hidden");
    serverMessage.classList.add("show");

    // Save to sessionStorage so it survives reload
    sessionStorage.setItem(
        "serverMessage",
        JSON.stringify({ message, type })
    );

    // Reset timer if already running
    if (serverMessageTimeout) clearTimeout(serverMessageTimeout);

    // Auto-close after 3s
    serverMessageTimeout = setTimeout(() => {
        hideServerMessage();
    }, 3000);
}

function hideServerMessage() {
    const serverMessage = document.getElementById("server-message");

    // Stop timer
    if (serverMessageTimeout) clearTimeout(serverMessageTimeout);

    // Remove from sessionStorage
    sessionStorage.removeItem("serverMessage");
    serverMessageTimeout = null;

    // Animate out
    serverMessage.classList.remove("show");

    setTimeout(() => {
        serverMessage.classList.add("hidden");
    }, 400); // matches CSS transition
}

// Close button → hide immediately & clear sessionStorage
document
    .getElementById("server-message-close")
    .addEventListener("click", () => {
        hideServerMessage();
    });

window.addEventListener("load", () => {
    const stored = sessionStorage.getItem("serverMessage");
    if (stored) {
        const { message, type } = JSON.parse(stored);
        if (message) showServerMessage(message, type);
        // don’t remove here — showServerMessage will auto-remove after timeout
    }
});
