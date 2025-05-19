// script.js (Updated for dynamic input, context switch, and visual output)

function getProcessesFromTable() {
  const table = document.getElementById('input-table').querySelector('tbody');
  const rows = table.querySelectorAll('tr');
  const processes = [];
  rows.forEach((row, i) => {
    const pid = row.cells[0].textContent.trim();
    const arrival = parseFloat(row.cells[1].querySelector('input').value);
    const burst = parseFloat(row.cells[2].querySelector('input').value);
    processes.push({ pid, arrival, burst, remaining: burst, priority: i + 1 });
  });
  return processes;
}

function getContextSwitchTime() {
  return parseFloat(document.getElementById('context-switch').value) || 0;
}

function updateOutputTable(results) {
  const tbody = document.getElementById('output-table');
  tbody.innerHTML = results.map(p => `
    <tr>
      <td>${p.pid}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      <td>${p.end}</td>
      <td>${p.tat}</td>
      <td>${p.wt}</td>
    </tr>`).join('');

  const totalTime = results.reduce((max, p) => Math.max(max, p.end), 0);
  const totalBurst = results.reduce((sum, p) => sum + p.burst, 0);
  const avgWT = results.reduce((sum, p) => sum + p.wt, 0) / results.length;
  const avgTAT = results.reduce((sum, p) => sum + p.tat, 0) / results.length;

  document.getElementById('cpu-util').textContent = ((totalBurst / totalTime) * 100).toFixed(2) + '%';
  document.getElementById('avg-wt').textContent = avgWT.toFixed(2);
  document.getElementById('avg-tat').textContent = avgTAT.toFixed(2);
}

function drawGanttChart(schedule) {
  const chart = document.getElementById('chart');
  chart.innerHTML = '';

  schedule.forEach((proc, i) => {
    const block = document.createElement('div');
    block.className = 'text-white text-sm p-2 rounded shadow opacity-0 scale-95 transition duration-500 ease-out';
    block.style.backgroundColor = colorForProcess(proc.pid);
    block.style.width = `${proc.duration * 40}px`;
    block.title = `${proc.pid} (${proc.start} - ${proc.end})`;
    block.innerText = proc.pid;
    setTimeout(() => {
      block.classList.remove('opacity-0', 'scale-95');
      block.classList.add('opacity-100', 'scale-100');
    }, i * 150);
    chart.appendChild(block);
  });
}

function colorForProcess(pid) {
  const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];
  const code = pid.charCodeAt(pid.length - 1) % palette.length;
  return palette[code];
}

// FCFS Algorithm
function runFCFS() {
  const processes = getProcessesFromTable().sort((a, b) => a.arrival - b.arrival);
  const cs = getContextSwitchTime();
  let time = 0;
  const gantt = [];

  processes.forEach((p, i) => {
    if (time < p.arrival) time = p.arrival;
    if (i !== 0) time += cs;
    const start = time;
    const end = start + p.burst;
    gantt.push({ pid: p.pid, start, end, duration: end - start });
    p.start = start;
    p.end = end;
    p.wt = start - p.arrival;
    p.tat = end - p.arrival;
    time = end;
  });

  updateOutputTable(processes);
  drawGanttChart(gantt);
}

// SJF Non-preemptive
function runSJF() {
  const processes = getProcessesFromTable();
  const cs = getContextSwitchTime();
  let time = 0, completed = 0;
  const gantt = [];

  while (completed < processes.length) {
    const ready = processes.filter(p => !p.done && p.arrival <= time)
                            .sort((a, b) => a.burst - b.burst);
    if (ready.length === 0) {
      time++;
      continue;
    }
    const p = ready[0];
    if (completed !== 0) time += cs;
    const start = Math.max(time, p.arrival);
    const end = start + p.burst;
    gantt.push({ pid: p.pid, start, end, duration: p.burst });
    p.start = start;
    p.end = end;
    p.wt = start - p.arrival;
    p.tat = end - p.arrival;
    p.done = true;
    completed++;
    time = end;
  }

  updateOutputTable(processes);
  drawGanttChart(gantt);
}

// SRTF Preemptive
function runSRTF() {
  const processes = getProcessesFromTable();
  const cs = getContextSwitchTime();
  let time = 0, completed = 0;
  const gantt = [];
  let last = null;

  while (completed < processes.length) {
    const ready = processes.filter(p => p.arrival <= time && p.remaining > 0)
                           .sort((a, b) => a.remaining - b.remaining);
    if (ready.length === 0) {
      time++;
      continue;
    }
    const current = ready[0];
    if (last && last !== current.pid) time += cs;
    const start = time;
    current.remaining--;
    time++;
    if (last !== current.pid) {
      gantt.push({ pid: current.pid, start });
    }
    if (current.remaining === 0) {
      current.end = time;
      current.tat = time - current.arrival;
      current.wt = current.tat - current.burst;
      completed++;
    }
    last = current.pid;
  }

  gantt.forEach((g, i) => g.end = gantt[i + 1] ? gantt[i + 1].start : time);
  gantt.forEach(g => g.duration = g.end - g.start);

  updateOutputTable(processes);
  drawGanttChart(gantt);
}

// Round Robin
function runRR() {
  const processes = getProcessesFromTable();
  const cs = getContextSwitchTime();
  const quantum = parseFloat(document.getElementById('quantum-time').value) || 2;
  let time = 0, queue = [], completed = 0;
  const gantt = [];
  processes.sort((a, b) => a.arrival - b.arrival);

  while (completed < processes.length) {
    processes.filter(p => !p.inQueue && p.arrival <= time).forEach(p => {
      queue.push(p);
      p.inQueue = true;
    });

    if (queue.length === 0) {
      time++;
      continue;
    }

    const p = queue.shift();
    if (p.lastExec !== undefined && p.lastExec !== time) time += cs;
    const start = time;
    const exec = Math.min(p.remaining, quantum);
    p.remaining -= exec;
    time += exec;
    gantt.push({ pid: p.pid, start, end: time, duration: exec });

    processes.filter(pr => !pr.inQueue && pr.arrival <= time).forEach(pr => {
      queue.push(pr);
      pr.inQueue = true;
    });

    if (p.remaining > 0) {
      queue.push(p);
    } else {
      p.end = time;
      p.tat = time - p.arrival;
      p.wt = p.tat - p.burst;
      completed++;
    }
    p.lastExec = time;
  }

  updateOutputTable(processes);
  drawGanttChart(gantt);
}

// Priority Scheduling
function runPriority() {
  const processes = getProcessesFromTable();
  const cs = getContextSwitchTime();
  let time = 0, completed = 0;
  const gantt = [];

  while (completed < processes.length) {
    const ready = processes.filter(p => !p.done && p.arrival <= time)
                           .sort((a, b) => a.priority - b.priority);
    if (ready.length === 0) {
      time++;
      continue;
    }
    const p = ready[0];
    if (completed !== 0) time += cs;
    const start = time;
    const end = start + p.burst;
    gantt.push({ pid: p.pid, start, end, duration: p.burst });
    p.start = start;
    p.end = end;
    p.tat = end - p.arrival;
    p.wt = p.tat - p.burst;
    p.done = true;
    completed++;
    time = end;
  }

  updateOutputTable(processes);
  drawGanttChart(gantt);
}
// Hook Run Button
document.getElementById('algorithm-select').addEventListener('change', () => {
  const quantumField = document.getElementById('quantum-input');
  if (document.getElementById('algorithm-select').value === 'rr') {
    quantumField.style.display = 'block';
  } else {
    quantumField.style.display = 'none';
  }
});

document.getElementById('run-btn').addEventListener('click', () => {
  const algo = document.getElementById('algorithm-select').value;
  if (algo === 'fcfs') runFCFS();
  else if (algo === 'sjf') runSJF();
  else if (algo === 'srtf') runSRTF();
  else if (algo === 'rr') runRR();
  else if (algo === 'priority') runPriority();
  else if (algo === 'dining') loadDiningPhilosophers();
});

// Dining Philosophers Loader
function loadDiningPhilosophers() {
  const main = document.querySelector('main');
  main.innerHTML = `
    <h2 class="text-2xl text-center font-semibold mb-6 text-blue-700">Dining Philosophers Visualization</h2>
    <p class="text-center text-lg mb-2">Number of Philosophers (1–5):</p>
    <div class="text-center mb-4">
      <button onclick="createTable()" class="bg-green-600 text-white px-6 py-2 rounded">Create Table</button>
    </div>
    <p class="text-center font-semibold text-blue-600 mb-4">Click on a philosopher to start or stop eating</p>
    <div id="circle"></div>
    <div id="mutex-status" class="text-center text-sm mt-4 font-mono"></div>
    <div class="mt-10 px-10">
      <h3 class="text-xl font-bold">🔧 The Setup</h3>
      <ul class="list-disc list-inside">
        <li>Five philosophers sit around a circular table.</li>
        <li>Each alternates between <strong>thinking</strong> and <strong>eating</strong>.</li>
        <li>There are only five chopsticks (shared between adjacent philosophers).</li>
        <li>A philosopher needs two chopsticks (left and right) to eat.</li>
      </ul>

      <h3 class="text-xl font-bold mt-4">🔒 How It Works in This Simulation</h3>
      <ul class="list-disc list-inside">
        <li>Each philosopher is represented by a <strong>thread</strong>.</li>
        <li>Each chopstick is protected by a <strong>mutex lock</strong>.</li>
        <li>To eat, a philosopher locks their <strong>left</strong> and <strong>right</strong> chopsticks.</li>
        <li>After eating, they <strong>unlock</strong> both and return to thinking.</li>
      </ul>

      <h3 class="text-xl font-bold mt-4 text-red-600">⚠️ Deadlock</h3>
      <p class="mb-2">A <strong>deadlock</strong> can happen when:</p>
      <ul class="list-disc list-inside">
        <li>All philosophers pick up their <strong>left chopstick</strong> at the same time.</li>
        <li>Each waits for the right one, forming a <strong>circular wait</strong>.</li>
      </ul>
      <p class="mt-2 font-semibold">Result: All philosophers are stuck. No one eats.</p>
    </div>
  `;

  createTable();
}

function createTable() {
  const circle = document.getElementById('circle');
  circle.innerHTML = '';
  circle.style.position = 'relative';
  circle.style.width = '400px';
  circle.style.height = '400px';
  circle.style.margin = 'auto';
  circle.style.border = '2px solid #ccc';
  circle.style.borderRadius = '50%';
  circle.style.background = '#fff';

  const count = 5;
  window.chopsticks = Array(count).fill(false); // false = free
  window.states = Array(count).fill('thinking');

  for (let i = 0; i < count; i++) {
    const angle = (i * 72) * (Math.PI / 180);
    const x = 200 + 150 * Math.cos(angle);
    const y = 200 + 150 * Math.sin(angle);

    const p = document.createElement('div');
    p.id = `philosopher${i}`;
    p.className = 'philosopher thinking';
    p.style.top = `${y}px`;
    p.style.left = `${x}px`;
    p.innerHTML = `P${i + 1}`;
    p.onclick = () => toggleEating(i);
    circle.appendChild(p);
  }

  for (let i = 0; i < count; i++) {
    const angle = ((i * 72) + 36) * (Math.PI / 180);
    const x = 200 + 120 * Math.cos(angle);
    const y = 200 + 120 * Math.sin(angle);

    const c = document.createElement('div');
    c.id = `chopstick${i}`;
    c.className = 'chopstick free';
    c.style.top = `${y}px`;
    c.style.left = `${x}px`;
    c.innerText = '🍴';
    circle.appendChild(c);
  }

  updateMutexDisplay();
}

function toggleEating(i) {
  const left = i;
  const right = (i + 1) % 5;

  if (states[i] === 'eating') {
    states[i] = 'thinking';
    chopsticks[left] = false;
    chopsticks[right] = false;
  } else {
    // Attempt to pick both chopsticks
    if (!chopsticks[left] && !chopsticks[right]) {
      states[i] = 'eating';
      chopsticks[left] = true;
      chopsticks[right] = true;
    } else {
      // Cannot eat — waiting state or ignored
      return;
    }
  }

  updateVisuals();
  updateMutexDisplay();
  checkDeadlock();
}

function updateVisuals() {
  for (let i = 0; i < 5; i++) {
    const p = document.getElementById(`philosopher${i}`);
    p.className = `philosopher ${states[i]}`;
  }

  for (let i = 0; i < 5; i++) {
    const c = document.getElementById(`chopstick${i}`);
    c.className = `chopstick ${chopsticks[i] ? 'taken' : 'free'}`;
  }
}

function updateMutexDisplay() {
  const mutexStatus = document.getElementById('mutex-status');
  mutexStatus.innerHTML = chopsticks.map((v, i) => `Chopstick ${i + 1}: ${v ? '🔒 Locked' : '🔓 Unlocked'}`).join(' | ');
}

function checkDeadlock() {
  const allWaiting = states.every((s, i) => s !== 'eating' && chopsticks[i]);
  if (allWaiting) {
    alert('⚠️ Deadlock detected! All philosophers are waiting.');
  }
}


// Hook Reset Button

document.getElementById('reset-btn').addEventListener('click', () => window.location.reload());
