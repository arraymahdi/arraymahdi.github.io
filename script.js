// ... (Keep existing code up to showProfile function unchanged)

async function showProfile() {
  // ... (Keep existing code up to the graphs section unchanged)

  // Fetch total XP
  const xpData = await fetchGraphQL(jwt, `
    {
      transaction_aggregate(where: { type: { _eq: "xp" } }) {
        aggregate {
          sum {
            amount
          }
        }
      }
    }
  `);
  const totalXP = xpData.data?.transaction_aggregate?.aggregate?.sum?.amount || 0;
  document.getElementById('total-xp').textContent = totalXP;

  // Fetch XP over time (for line graph)
  const xpOverTimeData = await fetchGraphQL(jwt, `
    {
      transaction(where: { type: { _eq: "xp" } }, order_by: { createdAt: asc }) {
        amount
        createdAt
      }
    }
  `);
  const transactions = xpOverTimeData.data?.transaction || [];
  renderXpOverTime(transactions);

  // Fetch XP per year (for bar chart)
  const xpPerYearData = await fetchGraphQL(jwt, `
    {
      transaction(where: { type: { _eq: "xp" } }) {
        amount
        createdAt
      }
    }
  `);
  renderXpPerYear(xpPerYearData.data?.transaction || []);

  // Fetch audits assigned per year
  const auditsPerYearData = await fetchGraphQL(jwt, `
    {
      user(where: {id: {_eq: "${userId}"}}) {
        auditsAssigned
        records {
          createdAt
        }
      }
    }
  `);
  renderAuditsPerYear(auditsPerYearData.data?.user[0] || {});

  // Render audit ratio (existing)
  renderAuditRatio({ auditRatio: user.auditRatio || 0 });
}

// Enhanced XP Over Time with Year Markers and Tooltips
function renderXpOverTime(transactions) {
  const svg = document.getElementById('xp-over-time');
  svg.innerHTML = '';

  if (transactions.length === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'graph-label');
    text.textContent = 'No XP Data Available';
    svg.appendChild(text);
    return;
  }

  let cumulativeXP = 0;
  const data = transactions.map(t => {
    cumulativeXP += t.amount;
    return { date: new Date(t.createdAt), xp: cumulativeXP };
  });

  const width = 500;
  const height = 300;
  const paddingTopBottom = 50;
  const paddingLeft = 80;
  const paddingRight = 50;
  const minDate = new Date(Math.min(...data.map(d => d.date)));
  const maxDate = new Date(Math.max(...data.map(d => d.date)));
  const maxXP = Math.max(...data.map(d => d.xp));
  const xScale = (date) => ((date - minDate) / (maxDate - minDate)) * (width - paddingLeft - paddingRight) + paddingLeft;
  const yScale = (xp) => height - paddingTopBottom - (xp / maxXP) * (height - 2 * paddingTopBottom);

  // Draw line
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.date)},${yScale(d.xp)}`).join(' ');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', path);
  line.setAttribute('class', 'graph-line');
  svg.appendChild(line);

  // Add circles with tooltips
  data.forEach(d => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', xScale(d.date));
    circle.setAttribute('cy', yScale(d.xp));
    circle.setAttribute('r', 4);
    circle.setAttribute('class', 'graph-point');
    circle.setAttribute('data-tooltip', `${d.date.toLocaleDateString()}: ${d.xp} XP`);
    svg.appendChild(circle);
  });

  // Axes (unchanged from original)
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', paddingLeft);
  xAxis.setAttribute('y1', height - paddingTopBottom);
  xAxis.setAttribute('x2', width - paddingRight);
  xAxis.setAttribute('y2', height - paddingTopBottom);
  xAxis.setAttribute('class', 'graph-axis');
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', paddingLeft);
  yAxis.setAttribute('y1', paddingTopBottom);
  yAxis.setAttribute('x2', paddingLeft);
  yAxis.setAttribute('y2', height - paddingTopBottom);
  yAxis.setAttribute('class', 'graph-axis');
  svg.appendChild(yAxis);

  // Y-axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = height - paddingTopBottom - (i / yTicks) * (height - 2 * paddingTopBottom);
    const value = (i / yTicks) * maxXP;
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', paddingLeft - 5);
    tick.setAttribute('y1', y);
    tick.setAttribute('x2', paddingLeft);
    tick.setAttribute('y2', y);
    tick.setAttribute('class', 'graph-axis');
    svg.appendChild(tick);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', paddingLeft - 10);
    label.setAttribute('y', y + 5);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'graph-label');
    label.textContent = Math.round(value).toString();
    svg.appendChild(label);
  }

  // X-axis ticks with year emphasis
  const years = [...new Set(data.map(d => d.date.getFullYear()))];
  years.forEach(year => {
    const firstOfYear = new Date(year, 0, 1);
    if (firstOfYear >= minDate && firstOfYear <= maxDate) {
      const x = xScale(firstOfYear);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x);
      tick.setAttribute('y1', height - paddingTopBottom);
      tick.setAttribute('x2', x);
      tick.setAttribute('y2', height - paddingTopBottom + 10);
      tick.setAttribute('class', 'graph-axis');
      svg.appendChild(tick);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', height - paddingTopBottom + 25);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'graph-label');
      label.textContent = year;
      svg.appendChild(label);
    }
  });
}

// New Bar Chart: XP per Year
function renderXpPerYear(transactions) {
  const svg = document.getElementById('xp-per-year');
  svg.innerHTML = '';

  if (transactions.length === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'graph-label');
    text.textContent = 'No XP Data Available';
    svg.appendChild(text);
    return;
  }

  const yearlyXP = {};
  transactions.forEach(t => {
    const year = new Date(t.createdAt).getFullYear();
    yearlyXP[year] = (yearlyXP[year] || 0) + t.amount;
  });

  const years = Object.keys(yearlyXP).map(Number);
  const maxXP = Math.max(...Object.values(yearlyXP));
  const width = 500;
  const height = 300;
  const paddingTopBottom = 50;
  const paddingLeft = 80;
  const barWidth = (width - paddingLeft - 50) / years.length;

  years.forEach((year, i) => {
    const barHeight = (yearlyXP[year] / maxXP) * (height - 2 * paddingTopBottom);
    const x = paddingLeft + i * barWidth;
    const y = height - paddingTopBottom - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth - 5);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('class', 'graph-bar');
    rect.setAttribute('data-tooltip', `${year}: ${yearlyXP[year]} XP`);
    svg.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + (barWidth - 5) / 2);
    label.setAttribute('y', height - paddingTopBottom + 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'graph-label');
    label.textContent = year;
    svg.appendChild(label);
  });

  // Y-axis
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', paddingLeft);
  yAxis.setAttribute('y1', paddingTopBottom);
  yAxis.setAttribute('x2', paddingLeft);
  yAxis.setAttribute('y2', height - paddingTopBottom);
  yAxis.setAttribute('class', 'graph-axis');
  svg.appendChild(yAxis);

  // Y-axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = height - paddingTopBottom - (i / yTicks) * (height - 2 * paddingTopBottom);
    const value = (i / yTicks) * maxXP;
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', paddingLeft - 5);
    tick.setAttribute('y1', y);
    tick.setAttribute('x2', paddingLeft);
    tick.setAttribute('y2', y);
    tick.setAttribute('class', 'graph-axis');
    svg.appendChild(tick);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', paddingLeft - 10);
    label.setAttribute('y', y + 5);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'graph-label');
    label.textContent = Math.round(value).toString();
    svg.appendChild(label);
  });
}

// New Bar Chart: Audits Assigned per Year
function renderAuditsPerYear(userData) {
  const svg = document.getElementById('audits-per-year');
  svg.innerHTML = '';

  const records = userData.records || [];
  if (records.length === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'graph-label');
    text.textContent = 'No Audit Data Available';
    svg.appendChild(text);
    return;
  }

  const auditsPerYear = {};
  records.forEach(r => {
    const year = new Date(r.createdAt).getFullYear();
    auditsPerYear[year] = (auditsPerYear[year] || 0) + 1;
  });

  const years = Object.keys(auditsPerYear).map(Number);
  const maxAudits = Math.max(...Object.values(auditsPerYear));
  const width = 500;
  const height = 300;
  const paddingTopBottom = 50;
  const paddingLeft = 80;
  const barWidth = (width - paddingLeft - 50) / years.length;

  years.forEach((year, i) => {
    const barHeight = (auditsPerYear[year] / maxAudits) * (height - 2 * paddingTopBottom);
    const x = paddingLeft + i * barWidth;
    const y = height - paddingTopBottom - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth - 5);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('class', 'graph-bar');
    rect.setAttribute('data-tooltip', `${year}: ${auditsPerYear[year]} Audits`);
    svg.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + (barWidth - 5) / 2);
    label.setAttribute('y', height - paddingTopBottom + 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'graph-label');
    label.textContent = year;
    svg.appendChild(label);
  });

  // Y-axis
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', paddingLeft);
  yAxis.setAttribute('y1', paddingTopBottom);
  yAxis.setAttribute('x2', paddingLeft);
  yAxis.setAttribute('y2', height - paddingTopBottom);
  yAxis.setAttribute('class', 'graph-axis');
  svg.appendChild(yAxis);

  // Y-axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = height - paddingTopBottom - (i / yTicks) * (height - 2 * paddingTopBottom);
    const value = (i / yTicks) * maxAudits;
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', paddingLeft - 5);
    tick.setAttribute('y1', y);
    tick.setAttribute('x2', paddingLeft);
    tick.setAttribute('y2', y);
    tick.setAttribute('class', 'graph-axis');
    svg.appendChild(tick);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', paddingLeft - 10);
    label.setAttribute('y', y + 5);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'graph-label');
    label.textContent = Math.round(value).toString();
    svg.appendChild(label);
  });
}

// Tooltip functionality (add this at the end of the script)
document.querySelectorAll('.graph-point, .graph-bar').forEach(element => {
  element.addEventListener('mouseover', (e) => {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = e.target.getAttribute('data-tooltip');
    document.body.appendChild(tooltip);

    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + window.scrollY - 30}px`;
  });

  element.addEventListener('mouseout', () => {
    document.querySelector('.tooltip')?.remove();
  });
});

// ... (Keep existing fetchGraphQL and renderAuditRatio functions unchanged)
