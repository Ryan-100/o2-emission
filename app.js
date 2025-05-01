// To load data from JSON file
let data = [];
let filteredData = [];

// Load data from JSON file
d3.json("data.json").then(function(jsonData) {
    data = jsonData.data;
    filteredData = [...data];
    
    // Initial draw of all visualizations
    drawBarChart(filteredData);
    drawMap(filteredData);
    drawWordCloud(filteredData);
}).catch(function(error) {
    console.error("Error loading the data:", error);
});

// Highlight function for cross-visualization linking
function highlightCountry(country) {
    d3.selectAll(".bar").classed("highlight", d => d.country === country);
    d3.selectAll(".map-circle").classed("highlight", d => d.country === country);
    d3.selectAll(".word").classed("highlight", d => d.text === country);
}

function clearHighlight() {
    d3.selectAll(".bar, .map-circle, .word").classed("highlight", false);
}

// Helper to get container width or fallback to window width
function getContainerWidth(selector, fallback = 800) {
    const el = document.querySelector(selector);
    return el ? el.offsetWidth : fallback;
}

// bar Chart (Numerical)
function drawBarChart(dataToShow) {
    d3.select("#barchart").selectAll("*").remove();
    const containerWidth = getContainerWidth('#barchart', 800);
    const margin = { top: 20, right: 30, bottom: 80, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#barchart")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .attr("role", "figure")
        .attr("aria-label", "Bar chart of CO2 emissions per capita");

    const x = d3.scaleBand()
        .domain(dataToShow.map(d => d.country))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(dataToShow, d => d.emissions)])
        .nice()
        .range([height, 0]);

    // add X axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .text("Countries");

    // Add Y axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .text("CO2 Emissions (tons per capita)");

    // Add legend
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 100}, 0)`);

    legend.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", "#1F77B4");

    legend.append("text")
        .attr("x", 25)
        .attr("y", 15)
        .text("Emissions");

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .tickValues(x.domain().filter((d, i) => !(i % 5)))
        )
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));

    svg.selectAll(".bar")
        .data(dataToShow)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.country))
        .attr("y", d => y(d.emissions))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.emissions))
        .attr("fill", "#1F77B4")
        .attr("tabindex", 0)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "#FF7F0E");
            d3.select(".tooltip")
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px")
                .style("display", "block")
                .html(`Country: ${d.country}<br>Emissions: ${d.emissions} tons/capita`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", d => d3.select(this).classed("highlight") ? "#FF7F0E" : "#1F77B4");
            d3.select(".tooltip").style("display", "none");
        })
        .on("click", function(event, d) {
            highlightCountry(d.country);
        })
        .on("keydown", function(event, d) {
            if (event.key === "Enter") {
                highlightCountry(d.country);
            }
        });
}

// World Map (Spatiaal)
function drawMap(dataToShow) {
    d3.select("#map").selectAll("*").remove();
    const containerWidth = getContainerWidth('#map', 800);
    const width = containerWidth;
    const height = 400;

    // Create the SVG area for the map
    const svg = d3.select("#map")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("role", "figure")
        .attr("aria-label", "Map of CO2 emissions by country");

    // Create a color scale for emissions (low = purple, high = yellow)
    const color = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, d3.max(data, d => d.emissions)]);
    const legendDomain = color.domain();

    // Set up the map projection (how to draw the world on a flat surface)
    const projection = d3.geoMercator()
        .scale(width / 6)
        .translate([width / 2, height / 1.5]);

    // Create a path generator using the projection
    const path = d3.geoPath().projection(projection);

    // Set up zoom and pan behavior for the map
    // Only the map group will move, not the legend
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Allow zoom between 1x and 8x
        .on("zoom", (event) => {
            // Move the map group when zooming or panning
            svg.selectAll("g.map-group").attr("transform", event.transform);
        });

    // Attach zoom behavior to the SVG
    svg.call(zoom);

    // Load the world map data (GeoJSON format)
    d3.json("https://d3js.org/world-110m.v1.json").then(function(world) {
        // Create a group for all map elements (so we can zoom/pan them together)
        const g = svg.append("g")
            .attr("class", "map-group");

        // Draw country shapes
        g.selectAll("path")
            .data(topojson.feature(world, world.objects.countries).features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", "#E6E6E6") // Light gray for countries
            .attr("stroke", "#FFF"); // White borders

        // Draw a circle for each country in our data, colored by emissions
        g.selectAll(".map-circle")
            .data(dataToShow)
            .enter()
            .append("circle")
            .attr("class", "map-circle")
            .attr("cx", d => projection([d.lon, d.lat])[0]) // X position from longitude
            .attr("cy", d => projection([d.lon, d.lat])[1]) // Y position from latitude
            .attr("r", 5) // Circle radius
            .attr("fill", d => color(d.emissions)) // Color by emissions
            .attr("tabindex", 0)
            .on("mouseover", function(event, d) {
                // Highlight circle and show tooltip on hover
                d3.select(this).attr("r", 8).attr("fill", "#FF7F0E");
                d3.select(".tooltip")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
                    .style("display", "block")
                    .html(`Country: ${d.country}<br>Emissions: ${d.emissions} tons/capita`);
            })
            .on("mouseout", function(event, d) {
                // Reset circle and hide tooltip when not hovering
                d3.select(this).attr("r", 5).attr("fill", d => d3.select(this).classed("highlight") ? "#FF7F0E" : color(d.emissions));
                d3.select(".tooltip").style("display", "none");
            })
            .on("click", function(event, d) {
                // Highlight country on click
                highlightCountry(d.country);
            })
            .on("keydown", function(event, d) {
                // Highlight country on Enter key
                if (event.key === "Enter") {
                    highlightCountry(d.country);
                }
            });

        // --- Fixed Legend (not affected by zoom) ---
        // This legend shows the color scale for emissions
        const legendWidth = 160;
        const legendX = width - legendWidth - 20;
        const legendY = 20;

        // Create a color gradient for the legend
        const defs = svg.append("defs");
        const linearGradient = defs.append("linearGradient")
            .attr("id", "legend-gradient-fixed")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        const stops = d3.range(0, 1.01, 0.1);
        stops.forEach((s, i) => {
            linearGradient.append("stop")
                .attr("offset", `${s * 100}%`)
                .attr("stop-color", color(legendDomain[0] + s * (legendDomain[1] - legendDomain[0])));
        });

        // Draw the legend box and color bar
        const legend = svg.append("g")
            .attr("class", "legend-fixed")
            .attr("transform", `translate(${legendX},${legendY})`);

        legend.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 100)
            .attr("height", 15)
            .style("fill", "url(#legend-gradient-fixed)");

        // Add a scale (axis) below the color bar
        const legendScale = d3.scaleLinear()
            .domain(legendDomain)
            .range([0, 100]);
        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5)
            .tickFormat(d => d.toFixed(1));
        legend.append("g")
            .attr("class", "legend-axis")
            .attr("transform", "translate(0,15)")
            .call(legendAxis);

        // Add a label for the legend
        legend.append("text")
            .attr("x", -10)
            .attr("y", 45)
            .attr("font-size", 12)
            .text("Emissions (tons/capita)");
        // --- End Fixed Legend ---
    });
}

// Word Cloud (Textual)
function drawWordCloud(dataToShow) {
    d3.select("#wordcloud").selectAll("*").remove();
    const containerWidth = getContainerWidth('#wordcloud', 800);
    const width = containerWidth;
    const height = 400;

    const svg = d3.select("#wordcloud")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet")
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .attr("role", "figure")
        .attr("aria-label", "Word cloud of countries by CO2 emissions");

    const layout = d3.layout.cloud()
        .size([width, height])
        .words(dataToShow.map(d => ({ text: d.country, size: d.emissions * 10 })))
        .padding(5)
        .rotate(0)
        .fontSize(d => d.size)
        .on("end", draw);

    layout.start();

    function draw(words) {
        svg.selectAll(".word")
            .data(words)
            .enter()
            .append("text")
            .attr("class", "word")
            .style("font-size", d => d.size + "px")
            .style("fill", "#1F77B4")
            .attr("text-anchor", "middle")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .text(d => d.text)
            .attr("tabindex", 0)
            .on("mouseover", function(event, d) {
                d3.select(this).style("fill", "#FF7F0E");
                d3.select(".tooltip")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
                    .style("display", "block")
                    .html(`Country: ${d.text}<br>Emissions: ${data.find(c => c.country === d.text).emissions} tons/capita`);
            })
            .on("mouseout", function() {
                d3.select(this).style("fill", d => d3.select(this).classed("highlight") ? "#FF7F0E" : "#1F77B4");
                d3.select(".tooltip").style("display", "none");
            })
            .on("click", function(event, d) {
                highlightCountry(d.text);
            })
            .on("keydown", function(event, d) {
                if (event.key === "Enter") {
                    highlightCountry(d.text);
                }
            });
    }
}

// Initialize tooltip
d3.select("body").append("div").attr("class", "tooltip").style("display", "none");

// Event listeners for interactivity
d3.select("#region-filter").on("change", function() {
    const region = this.value;
    filteredData = region === "All" ? [...data] : data.filter(d => d.region === region);
    drawBarChart(filteredData);
    drawMap(filteredData);
    drawWordCloud(filteredData);
    clearHighlight();
});

d3.select("#sort-asc").on("click", function() {
    filteredData.sort((a, b) => a.emissions - b.emissions);
    drawBarChart(filteredData);
});

d3.select("#sort-desc").on("click", function() {
    filteredData.sort((a, b) => b.emissions - a.emissions);
    drawBarChart(filteredData);
});

d3.select("#emission-slider").on("input", function() {
    const minEmission = +this.value;
    d3.select("#slider-value").text(minEmission);
    filteredData = data.filter(d => d.emissions >= minEmission);
    drawBarChart(filteredData);
    drawMap(filteredData);
    drawWordCloud(filteredData);
    clearHighlight();
});

d3.select("#search-input").on("input", function() {
    const search = this.value.toLowerCase();
    filteredData = data.filter(d => d.country.toLowerCase().includes(search));
    drawBarChart(filteredData);
    drawMap(filteredData);
    drawWordCloud(filteredData);
    clearHighlight();
});


// Redraw charts on window resize for responsiveness
window.addEventListener('resize', () => {
    drawBarChart(filteredData);
    drawMap(filteredData);
    drawWordCloud(filteredData);
});