const loginSection = document.getElementById('login-section');
const profileSection = document.getElementById('profile-section');
const errorMessage = document.getElementById('error-message');
const logoutButton = document.getElementById('logout-button');

// Check authentication on load
document.addEventListener('DOMContentLoaded', () => {
  localStorage.getItem('jwt') ? showProfile() : showLogin();
});

// Login form submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('usernameOrEmail').value.trim();
  const password = document.getElementById('password').value;
  
  try {
    const credentials = btoa(`${usernameOrEmail}:${password}`);
    const response = await fetch('https://cors-anywhere.herokuapp.com/https://learn.reboot01.com/api/auth/signin', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}` }
    });

    if (!response.ok) throw new Error('Invalid credentials');
    
    const data = await response.json();
    const token = typeof data === 'string' ? data : data.token;
    if (!token) throw new Error('No token received');
    
    localStorage.setItem('jwt', token);
    showProfile();
  } catch (error) {
    console.error('Login Error:', error);
    errorMessage.textContent = error.message;
    errorMessage.style.display = 'block';
  }
});

// Logout
logoutButton.addEventListener('click', () => {
  localStorage.removeItem('jwt');
  showLogin();
});

function showLogin() {
  loginSection.style.display = 'block';
  profileSection.style.display = 'none';
  errorMessage.style.display = 'none';
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (error) {
    console.error('JWT Decode Error:', error);
    return null;
  }
}

async function showProfile() {
  loginSection.style.display = 'none';
  profileSection.style.display = 'block';

  const jwt = localStorage.getItem('jwt');
  if (!jwt) return showLogin();

  const payload = decodeJwtPayload(jwt);
  if (!payload?.sub) {
    localStorage.removeItem('jwt');
    return showLogin();
  }

  const userId = payload.sub;

  try {
    const userData = await fetchGraphQL(jwt, `
      {
        user(where: {id: {_eq: "${userId}"}}) {
          id login email firstName lastName campus auditRatio auditsAssigned attrs
          records { id createdAt }
          transactions(where: { type: { _eq: "xp" } }) { amount createdAt path }
        }
      }
    `);

    const user = userData.data?.user[0];
    if (!user) throw new Error('User data not found');

    ['user-id', 'username', 'email', 'first-name', 'last-name', 'campus'].forEach(id => {
      document.getElementById(id).textContent = user[id.replace('-', '')] || 'N/A';
    });
    document.getElementById('audits-assigned').textContent = user.auditsAssigned || 0;
    document.getElementById('records-count').textContent = user.records?.length || 0;

    const attrsContainer = document.getElementById('attributes');
    attrsContainer.innerHTML = '<strong>Attributes:</strong>';
    if (user.attrs && typeof user.attrs === 'object') {
      Object.entries(user.attrs)
        .filter(([key]) => !['email', 'firstName', 'lastName', 'id-cardUploadId', 'pro-picUploadId'].includes(key))
        .forEach(([key, value]) => {
          const p = document.createElement('p');
          p.innerHTML = `<span>${key}:</span> ${value || 'N/A'}`;
          attrsContainer.appendChild(p);
        });
    }

    const totalXP = user.transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    document.getElementById('total-xp').textContent = totalXP.toLocaleString();

    renderXpOverTime(user.transactions || []);
    renderXpPerMonth(user.transactions || []);
    renderAuditRatio({ auditRatio: user.auditRatio || 0 });

  } catch (error) {
    console.error('Profile Error:', error);
    localStorage.removeItem('jwt');
    showLogin();
  }
}

async function fetchGraphQL(jwt, query) {
  const response = await fetch('https://cors-anywhere.herokuapp.com/https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error('GraphQL request failed');
  return response.json();
}

function renderXpOverTime(transactions) {
  const svg = document.getElementById('xp-over-time');
  if (!svg) return console.error('SVG element with ID "xp-over-time" not found');
  svg.innerHTML = '';
  const width = 700, height = 450, padding = 70;

  if (!transactions.length) return renderNoData(svg, 'No XP Data Available');

  let cumulativeXP = 0;
  const data = transactions.map(t => ({ date: new Date(t.createdAt), xp: (cumulativeXP += t.amount) }));
  const xScale = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([padding, width - padding]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.xp) * 1.1]).range([height - padding, padding]);

  // Use d3.select for DOM elements
  d3.select(svg)
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-width + 2 * padding).tickFormat(''));

  const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.xp)).curve(d3.curveMonotoneX);
  const path = svg.appendChild(createPath(line(data), 'graph-line'));
  path.animate([{ strokeDashoffset: path.getTotalLength() }, { strokeDashoffset: 0 }], { duration: 1000 });

  data.forEach(d => {
    const circle = createCircle(xScale(d.date), yScale(d.xp), 5, 'graph-point');
    circle.setAttribute('data-tooltip', `${d.date.toLocaleDateString()}: ${d.xp.toLocaleString()} XP`);
    svg.appendChild(circle);
  });

  d3.select(svg)
    .append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%b %Y')))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end');

  d3.select(svg)
    .append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5));
}

function renderXpPerMonth(transactions) {
  const container = document.getElementById('xp-per-month').parentElement;
  const svg = document.getElementById('xp-per-month');
  if (!svg) return console.error('SVG element with ID "xp-per-month" not found');
  svg.innerHTML = '';
  
  const visibleWidth = 800, height = 500, padding = 80;
  const fullWidth = Math.max(transactions.length * 60, visibleWidth); // Ensure minimum width
  
  svg.setAttribute('width', fullWidth);
  svg.setAttribute('viewBox', `0 0 ${fullWidth} ${height}`);
  container.style.overflowX = 'auto';
  container.style.maxWidth = `${visibleWidth}px`;

  if (!transactions.length) return renderNoData(svg, 'No XP Data Available');

  const monthlyXP = d3.group(transactions, t => {
    const d = new Date(t.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const data = Array.from(monthlyXP, ([key, values]) => ({
    date: new Date(key),
    xp: d3.sum(values, v => v.amount)
  })).sort((a, b) => a.date - b.date);

  const xScale = d3.scaleBand()
    .domain(data.map(d => d.date.toISOString().slice(0, 7)))
    .range([padding, fullWidth - padding])
    .padding(0.4);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.xp) * 1.2])
    .range([height - padding, padding]);

  d3.select(svg)
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-fullWidth + 2 * padding).tickFormat(''));

  data.forEach(d => {
    const bar = createRect(
      xScale(d.date.toISOString().slice(0, 7)),
      height - padding,
      xScale.bandwidth(),
      0,
      'graph-bar'
    );
    bar.setAttribute('data-tooltip', `${d.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${d.xp.toLocaleString()} XP`);
    svg.appendChild(bar);
    setTimeout(() => {
      bar.setAttribute('y', yScale(d.xp));
      bar.setAttribute('height', height - padding - yScale(d.xp));
    }, 100);
  });

  d3.select(svg)
    .append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).tickFormat(d => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end')
    .attr('dy', '0.5em');

  d3.select(svg)
    .append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5));
}

function renderAuditRatio(data) {
  const svg = document.getElementById('audit-ratio');
  if (!svg) return console.error('SVG element with ID "audit-ratio" not found');
  svg.innerHTML = '';
  const width = 700, height = 450, radius = 150;

  if (!data.auditRatio) return renderNoData(svg, 'No Audit Data Available');

  const arc = d3.arc().innerRadius(60).outerRadius(radius);
  const pie = d3.pie().value(d => d.value);
  const arcs = pie([
    { name: 'Audit Ratio', value: data.auditRatio },
    { name: 'Remaining', value: 1 - data.auditRatio }
  ]);

  const g = svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
  g.setAttribute('transform', `translate(${width / 2}, ${height / 2})`);

  arcs.forEach((d, i) => {
    const path = createPath(arc(d), 'graph-bar');
    path.setAttribute('fill', i === 0 ? '#00ffff' : '#8e24aa');
    path.setAttribute('data-tooltip', `${d.data.name}: ${(d.data.value * 100).toFixed(1)}%`);
    g.appendChild(path);
    path.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 800, easing: 'ease-out' });
  });

  arcs.forEach(d => {
    const [x, y] = arc.centroid(d);
    const text = createText(x, y, `${d.data.name}: ${(d.data.value * 100).toFixed(1)}%`, 'graph-label');
    text.setAttribute('text-anchor', 'middle');
    g.appendChild(text);
  });
}

// Utility Functions
function createPath(d, className) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', className);
  return path;
}

function createCircle(cx, cy, r, className) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', r);
  circle.setAttribute('class', className);
  return circle;
}

function createRect(x, y, width, height, className) {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('class', className);
  return rect;
}

function createText(x, y, content, className) {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', x);
  text.setAttribute('y', y);
  text.setAttribute('class', className);
  text.textContent = content;
  return text;
}

function renderNoData(svg, message) {
  svg.appendChild(createText(svg.getAttribute('width') / 2, svg.getAttribute('height') / 2, message, 'graph-label'))
    .setAttribute('text-anchor', 'middle');
}

// Tooltip Handling
document.addEventListener('mouseover', e => {
  if (e.target.matches('.graph-point, .graph-bar')) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = e.target.getAttribute('data-tooltip');
    document.body.appendChild(tooltip);

    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 10}px`;
  }
});

document.addEventListener('mouseout', e => {
  if (e.target.matches('.graph-point, .graph-bar')) {
    document.querySelector('.tooltip')?.remove();
  }
});
