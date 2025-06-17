// //login
// document.getElementById("loginForm").addEventListener("submit", function(e) {
//   e.preventDefault();

//   const username = document.getElementById("username").value.trim();
//   const password = document.getElementById("password").value.trim();

//   document.getElementById("userError").textContent = "";
//   document.getElementById("passError").textContent = "";

//   let hasError = false;

//   if (username === "") {
//     document.getElementById("userError").textContent = "Username is required.";
//     hasError = true;
//   }

//   if (password === "") {
//     document.getElementById("passError").textContent = "Password is required.";
//     hasError = true;
//   }

//   if (hasError) return;

//   // Check credentials
//   if (username === "admin" && password === "1234") {
//     alert("Login successful!");
//     window.location.href = "home.html"; // Redirect
//   } else {
//     alert("Invalid username or password.");
//   }
// });
// MQTT Setup
const broker = 'wss://broker.emqx.io:8084/mqtt';
const topic = 'relay/control';
const relayState = { r1: 'OFF', r2: 'OFF', r3: 'OFF', r4: 'OFF' };

const client = mqtt.connect(broker);

client.on('connect', () => {
  document.getElementById('status').innerText = '✅ Connected to MQTT broker';
  document.getElementById('status').style.color = 'green';
});

client.on('error', (err) => {
  document.getElementById('status').innerText = '❌ MQTT Error: ' + err.message;
  document.getElementById('status').style.color = 'red';
});

function toggleRelay(elem) {
  const id = elem.id;
  const state = elem.checked ? 'ON' : 'OFF';
  relayState[id] = state;

  // Publish the updated state
  client.publish(topic, JSON.stringify(relayState));

  // Update UI
  const label = document.getElementById(`status-${id}`);
  label.innerText = `Status: ${state}`;
}

// Timer functionality
let timers = [];

function setTimer() {
  const hours = parseInt(document.getElementById('hours').value) || 0;
  const minutes = parseInt(document.getElementById('minutes').value) || 0;
  const seconds = parseInt(document.getElementById('seconds').value) || 0;
  const action = document.getElementById('timerAction').value;

  const totalMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
  if (totalMs <= 0) {
    alert('Please set a valid timer duration.');
    return;
  }

  const timerId = Date.now();
  timers.push(timerId);

  // Display timer
  const timerItem = document.createElement('div');
  timerItem.className = 'timer-item';
  timerItem.id = 'timer-' + timerId;
  timerItem.innerHTML = `
    <span>Will turn <strong>${action}</strong> all relays in ${hours}h ${minutes}m ${seconds}s</span>
    <button class="delete-btn" onclick="cancelTimer(${timerId})">Cancel</button>
  `;
  document.getElementById('activeTimers').appendChild(timerItem);

  setTimeout(() => {
    if (!timers.includes(timerId)) return; // canceled

    // Perform action on all relays
    ['r1','r2','r3','r4'].forEach(r => {
      relayState[r] = action;
      const checkbox = document.getElementById(r);
      checkbox.checked = (action === 'ON');
      const label = document.getElementById(`status-${r}`);
      label.innerText = `Status: ${action}`;
    });
    
    client.publish(topic, JSON.stringify(relayState));

    // Remove timer UI
    const elem = document.getElementById('timer-' + timerId);
    if (elem) elem.remove();

    timers = timers.filter(id => id !== timerId);
  }, totalMs);
}

function cancelTimer(id) {
  timers = timers.filter(tid => tid !== id);
  const elem = document.getElementById('timer-' + id);
  if (elem) elem.remove();
}

// Scheduling functionality
let schedules = [];

function addSchedule() {
  const relayId = document.getElementById('scheduleRelay').value;
  const time = document.getElementById('scheduleTime').value;
  const action = document.getElementById('scheduleAction').value;

  if (!time) {
    alert('Please select a time for the schedule.');
    return;
  }

  const scheduleId = Date.now();
  const [hours, minutes] = time.split(':').map(Number);

  schedules.push({
    id: scheduleId,
    relayId,
    hours,
    minutes,
    action
  });

  // Display schedule
  const scheduleItem = document.createElement('div');
  scheduleItem.className = 'schedule-item';
  scheduleItem.id = `schedule-${scheduleId}`;
  scheduleItem.innerHTML = `
    <span>At ${time} - Turn <strong>${action}</strong></span>
    <button class="delete-btn" onclick="removeSchedule(${scheduleId})">Delete</button>
  `;
  document.getElementById(`schedules-${relayId}`).appendChild(scheduleItem);

  // Save to localStorage
  saveSchedules();
}

function removeSchedule(id) {
  schedules = schedules.filter(s => s.id !== id);
  const elem = document.getElementById(`schedule-${id}`);
  if (elem) elem.remove();
  saveSchedules();
}

function saveSchedules() {
  localStorage.setItem('relaySchedules', JSON.stringify(schedules));
}

function loadSchedules() {
  const savedSchedules = localStorage.getItem('relaySchedules');
  if (savedSchedules) {
    schedules = JSON.parse(savedSchedules);
    schedules.forEach(schedule => {
      const timeStr = `${String(schedule.hours).padStart(2, '0')}:${String(schedule.minutes).padStart(2, '0')}`;
      const scheduleItem = document.createElement('div');
      scheduleItem.className = 'schedule-item';
      scheduleItem.id = `schedule-${schedule.id}`;
      scheduleItem.innerHTML = `
        <span>At ${timeStr} - Turn <strong>${schedule.action}</strong></span>
        <button class="delete-btn" onclick="removeSchedule(${schedule.id})">Delete</button>
      `;
      document.getElementById(`schedules-${schedule.relayId}`).appendChild(scheduleItem);
    });
  }
}

function checkSchedules() {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  schedules.forEach(schedule => {
    if (schedule.hours === currentHours && schedule.minutes === currentMinutes) {
      // Perform the scheduled action
      relayState[schedule.relayId] = schedule.action;
      const checkbox = document.getElementById(schedule.relayId);
      checkbox.checked = (schedule.action === 'ON');
      const label = document.getElementById(`status-${schedule.relayId}`);
      label.innerText = `Status: ${schedule.action}`;
      
      client.publish(topic, JSON.stringify(relayState));
    }
  });
}
// Voice Control functionality
let recognition;

function startVoiceControl() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    document.getElementById('voiceStatus').innerText = 
      'Voice control not supported in this browser. Try Chrome or Edge.';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  const voiceBtn = document.getElementById('voiceControlBtn');
  voiceBtn.classList.add('listening');
  voiceBtn.textContent = 'Listening...';
  document.getElementById('voiceStatus').innerHTML = 'Listening... Speak now.';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    let statusHTML = `
      <div>You said: "${transcript}"</div>
    `;
    
    // Process command and add action to status
    const turnOnMatch = transcript.match(/turn on relay (\d)/i);
    const turnOffMatch = transcript.match(/turn off relay (\d)/i);
    const turnOnAllMatch = transcript.match(/turn on all relays?/i);
    const turnOffAllMatch = transcript.match(/turn off all relays?/i);

    if (turnOnMatch) {
      const relayNum = turnOnMatch[1];
      toggleRelay(document.getElementById(`r${relayNum}`), 'ON');
      statusHTML += `<div>Turning ON relay ${relayNum}</div>`;
    } 
    else if (turnOffMatch) {
      const relayNum = turnOffMatch[1];
      toggleRelay(document.getElementById(`r${relayNum}`), 'OFF');
      statusHTML += `<div>Turning OFF relay ${relayNum}</div>`;
    }
    else if (turnOnAllMatch) {
      ['r1','r2','r3','r4'].forEach(relayId => {
        toggleRelay(document.getElementById(relayId), 'ON');
      });
      statusHTML += `<div>Turning ON all relays</div>`;
    }
    else if (turnOffAllMatch) {
      ['r1','r2','r3','r4'].forEach(relayId => {
        toggleRelay(document.getElementById(relayId), 'OFF');
      });
      statusHTML += `<div>Turning OFF all relays</div>`;
    }
    else {
      statusHTML += `<div>Command not recognized. Try again.</div>`;
    }

    document.getElementById('voiceStatus').innerHTML = statusHTML;
  };

  recognition.onerror = (event) => {
    document.getElementById('voiceStatus').innerText = 
      `Error: ${event.error === 'no-speech' ? 'No speech detected' : event.error}`;
    resetVoiceButton();
  };

  recognition.onend = () => {
    resetVoiceButton();
  };

  recognition.start();
}

function resetVoiceButton() {
  const voiceBtn = document.getElementById('voiceControlBtn');
  voiceBtn.classList.remove('listening');
  voiceBtn.textContent = 'Start Listening';
}

// Update toggleRelay function to handle manual and voice control
function toggleRelay(elem, state = null) {
  const id = elem.id ? elem.id : elem; // Handle both element and ID
  const checkbox = typeof elem === 'object' ? elem : document.getElementById(elem);
  
  // Determine new state
  let newState;
  if (state === 'TOGGLE') {
    newState = relayState[id] === 'ON' ? 'OFF' : 'ON';
  } else if (state) {
    newState = state;
  } else {
    newState = checkbox.checked ? 'ON' : 'OFF';
  }

  relayState[id] = newState;
  
  // Update checkbox state
  checkbox.checked = newState === 'ON';
  
  // Update UI
  const label = document.getElementById(`status-${id}`);
  if (label) label.innerText = `Status: ${newState}`;
  
  // Publish the updated state
  client.publish(topic, JSON.stringify(relayState));
}

// Update window.onload to initialize voice control if supported
window.onload = () => {
  // Load theme
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.body.classList.add('dark');
  }

  // Load schedules
  loadSchedules();

  // Check schedules every minute
  setInterval(checkSchedules, 60000);

  // Check for speech recognition support
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    document.getElementById('voiceControlBtn').style.display = 'none';
    document.getElementById('voiceStatus').innerText = 
      'Voice control not supported in this browser. Try Chrome or Edge.';
  }
};

// Theme toggle functionality
function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize on load
window.onload = () => {
  // Load theme
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.body.classList.add('dark');
  }

  // Load schedules
  loadSchedules();

  // Check schedules every minute
  setInterval(checkSchedules, 60000);
};

