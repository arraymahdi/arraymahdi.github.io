const loginSection = document.getElementById('login-section');
const profileSection = document.getElementById('profile-section');
const errorMessage = document.getElementById('error-message');
const logoutButton = document.getElementById('logout-button');

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('jwt')) {
    showProfile();
  } else {
    showLogin();
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('usernameOrEmail').value.trim();
  const password = document.getElementById('password').value;

  try {
    const credentials = btoa(`${usernameOrEmail}:${password}`);
    const response = await fetch('https://learn.reboot01.com/api/auth/signin', {
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

logoutButton.addEventListener('click', () => {
  localStorage.removeItem('jwt');
  showLogin();
});

function showLogin() {
  loginSection.style.display = 'block';
  profileSection.style.display = 'none';
  errorMessage.style.display = 'none';
}

function showProfile() {
  loginSection.style.display = 'none';
  profileSection.style.display = 'block';
  fetchProfileData();
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

async function fetchProfileData() {
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
          id login email auditRatio auditsAssigned attrs
          records { id createdAt }
          transactions(where: { type: { _eq: "xp" } }) { amount createdAt path }
        }
      }
    `);

    const user = userData.data?.user[0];
    if (!user) throw new Error('User data not found');

    document.getElementById('user-id').textContent = user.id || 'N/A';
    document.getElementById('username').textContent = user.login || 'N/A';
    document.getElementById('email').textContent = user.email || 'N/A';
    document.getElementById('audits-assigned').textContent = user.auditsAssigned || '0';
    document.getElementById('records-count').textContent = user.records?.length || '0';

    const attrsContainer = document.getElementById('attributes');
    attrsContainer.innerHTML = '<strong>Attributes:</strong>';
    if (user.attrs && typeof user.attrs === 'object') {
      Object.entries(user.attrs).forEach(([key, value]) => {
        const p = document.createElement('p');
        p.innerHTML = `<span>${key}:</span> ${value || 'N/A'}`;
        attrsContainer.appendChild(p);
      });
    }

    const totalXP = user.transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    document.getElementById('total-xp').textContent = totalXP.toLocaleString();

    renderXpOverTime(user.transactions || []);
    renderXpPerMonth(user.transactions || []);
    renderAuditRatio(user.auditRatio || 0);

  } catch (error) {
    console.error('Profile Error:', error);
    localStorage.removeItem('jwt');
    showLogin();
  }
}

async function fetchGraphQL(jwt, query) {
  const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
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
  const svg = d3.select('#xp-over-time');
  svg.selectAll('*').remove();
  const width = 700, height = 450, padding = 70;

  if (!transactions.length) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'graph-label')
      .text('No XP Data');
    return;
  }

  let cumulativeXP = 0;
  const sortedTransactions = transactions
    .map(t => ({ date: new Date(t.createdAt), xp: (cumulativeXP += t.amount) }))
    .sort((a, b) => a.date - b.date);

  const xScale = d3.scaleTime()
    .domain(d3.extent(sortedTransactions, d => d.date))
    .range([padding, width - padding]);

  const yMax = d3.max(sortedTransactions, d => d.xp) || 1;
  const yScale = d3.scaleLinear()
    .domain([0, yMax * 1.1])
    .range([height - padding, padding]);

  svg.append('path')
    .datum(sortedTransactions)
    .attr('class', 'graph-line')
    .attr('d', d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.xp))
      .curve(d3.curveLinear)
    );

  svg.selectAll('.graph-point')
    .data(sortedTransactions)
    .enter()
    .append('circle')
    .attr('class', 'graph-point')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.xp))
    .attr('r', 5)
    .on('mouseover', function (event, d) {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${d.date.toLocaleDateString()}: ${d.xp.toLocaleString()} XP`;
      document.body.appendChild(tooltip);

      setTimeout(() => {
        const rect = this.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 10}px`;
      }, 0);
    })
    .on('mouseout', () => document.querySelector('.tooltip')?.remove());

  svg.append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%b %Y')))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end');

  svg.append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5));
}

function renderXpPerMonth(transactions) {
  const svg = d3.select('#xp-per-month');
  svg.selectAll('*').remove();
  const visibleWidth = 700, height = 500, padding = 70;
  const barWidth = 25;
  const fullWidth = Math.max(transactions.length * (barWidth + 2), visibleWidth);

  svg.attr('width', fullWidth);
  svg.attr('viewBox', `0 0 ${fullWidth} ${height}`);
  svg.node().parentElement.style.maxWidth = `${visibleWidth}px`;
  svg.node().parentElement.style.overflowX = 'auto';

  if (!transactions.length) {
    svg.append('text')
      .attr('x', fullWidth / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'graph-label')
      .text('No XP Data');
    return;
  }

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
    .padding(0.05);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.xp) * 1.2])
    .range([height - padding, padding]);

  svg.append('g')
    .attr('class', 'graph-grid')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(10).tickSize(-fullWidth + 2 * padding).tickFormat(''));

  svg.selectAll('.graph-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'graph-bar')
    .attr('x', d => xScale(d.date.toISOString().slice(0, 7)) + (xScale.bandwidth() - barWidth) / 2)
    .attr('y', d => yScale(d.xp))
    .attr('width', barWidth)
    .attr('height', d => height - padding - yScale(d.xp))
    .on('mouseover', function(event, d) {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${d.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${d.xp.toLocaleString()} XP`;
      document.body.appendChild(tooltip);
      const rect = this.getBoundingClientRect();
      tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
      tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 10}px`;
    })
    .on('mouseout', () => document.querySelector('.tooltip')?.remove());

  svg.append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).tickFormat(d => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end');

  svg.append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5));
}

function renderAuditRatio(auditRatio) {
  const svg = d3.select('#audit-ratio');
  svg.selectAll('*').remove();
  const width = 700, height = 450, radius = 150;

  if (!auditRatio) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('class', 'graph-label')
      .text('No Audit Data');
    return;
  }

  const data = [
    { name: 'Audits Done', value: auditRatio },
    { name: 'Audits Left', value: 1 - auditRatio }
  ];
  const arc = d3.arc().innerRadius(80).outerRadius(radius);
  const pie = d3.pie().value(d => d.value);

  const arcs = svg.selectAll('.arc')
    .data(pie(data))
    .enter()
    .append('g')
    .attr('class', 'arc')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  arcs.append('path')
    .attr('d', arc)
    .attr('class', 'graph-bar')
    .attr('fill', (d, i) => i === 0 ? '#8b5a2b' : '#d2b48c')
    .on('mouseover', function(event, d) {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${d.data.name}: ${(d.data.value * 100).toFixed(1)}%`;
      document.body.appendChild(tooltip);
      const rect = this.getBoundingClientRect();
      tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
      tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 10}px`;
    })
    .on('mouseout', () => document.querySelector('.tooltip')?.remove());

  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('class', 'graph-label')
    .attr('text-anchor', 'middle')
    .text(d => `${d.data.name}: ${(d.data.value * 100).toFixed(1)}%`);
}
