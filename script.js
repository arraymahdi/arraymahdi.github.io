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
    // Replace with your proxy URL or test locally
    const response = await fetch('https://your-proxy.vercel.app/signin', {
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
          id login email
          transactions(where: { type: { _eq: "xp" } }) { amount createdAt }
        }
      }
    `);

    const user = userData.data?.user[0];
    if (!user) throw new Error('User data not found');

    document.getElementById('user-id').textContent = user.id || 'N/A';
    document.getElementById('username').textContent = user.login || 'N/A';
    document.getElementById('email').textContent = user.email || 'N/A';
    const totalXP = user.transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    document.getElementById('total-xp').textContent = totalXP.toLocaleString();

    renderXpOverTime(user.transactions || []);
    renderXpPerMonth(user.transactions || []);

  } catch (error) {
    console.error('Profile Error:', error);
    localStorage.removeItem('jwt');
    showLogin();
  }
}

async function fetchGraphQL(jwt, query) {
  const response = await fetch('https://your-proxy.vercel.app/graphql', {
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
  const width = 600, height = 400, padding = 60;

  if (!transactions.length) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .text('No XP Data Available');
    return;
  }

  let cumulativeXP = 0;
  const data = transactions.map(t => ({ date: new Date(t.createdAt), xp: (cumulativeXP += t.amount) }));
  const xScale = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([padding, width - padding]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.xp)]).range([height - padding, padding]);

  svg.append('path')
    .datum(data)
    .attr('class', 'graph-line')
    .attr('d', d3.line().x(d => xScale(d.date)).y(d => yScale(d.xp)));

  svg.append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(5));

  svg.append('g')
    .attr('class', 'graph-axis')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5));
}

function renderXpPerMonth(transactions) {
  const svg = d3.select('#xp-per-month');
  svg.selectAll('*').remove();
  const width = 600, height = 400, padding = 60;

  if (!transactions.length) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .text('No XP Data Available');
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
    .range([padding, width - padding])
    .padding(0.2);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.xp)])
    .range([height - padding, padding]);

  svg.selectAll('.graph-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'graph-bar')
    .attr('x', d => xScale(d.date.toISOString().slice(0, 7)))
    .attr('y', d => yScale(d.xp))
    .attr('width', xScale.bandwidth())
    .attr('height', d => height - padding - yScale(d.xp));

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
