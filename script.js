// Set up dimensions and margins
const margin = { top: 40, right: 120, bottom: 40, left: 60 };
const width = 1008 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

console.log("Initializing visualization with dimensions:", { width, height, margin });

// Helper function to display debug information on the page
function debugLog(message, isError = false) {
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

debugLog("Starting visualization initialization");

// Append the svg object to the visualization div
const svg = d3.select("#visualization")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

console.log("SVG element created");
debugLog("SVG container created with dimensions: " + (width + margin.left + margin.right) + "x" + (height + margin.top + margin.bottom));

// Function to handle errors
function handleError(error) {
  console.error("Error loading the data: ", error);
  
  // Remove any existing visualization elements before showing error
  svg.selectAll("*").remove();
  d3.select("#visualization svg").remove();
  
  d3.select("#visualization")
    .append("div")
    .attr("class", "error-message")
    .html(`<p>Sorry, there was an error loading the data: ${error.message || "Unknown error"}. Please check that final_df_cleaned.csv exists and is accessible.</p>`);
}

// Show loading indicator
d3.select("#visualization")
  .append("div")
  .attr("class", "loading-message")
  .html("<p>Loading data, please wait...</p>");

// Add tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

console.log("Starting to load CSV data");
debugLog("Attempting to load CSV data from final_df_cleaned.csv");

// Load the data with better error handling
d3.csv("final_df_cleaned.csv")
  .then(function(data) {
    console.log("CSV data loaded successfully, row count:", data.length);
    debugLog(`CSV loaded successfully with ${data.length} rows`);
    
    // Remove loading message once data is loaded
    d3.select(".loading-message").remove();
    
    if (!data || data.length === 0) {
      throw new Error("No data found in CSV file");
    }
    
    // Check for necessary columns in the first row
    const firstRow = data[0];
    const requiredColumns = ["track_name", "artists", "track_genre", "popularity", "Track_Score", 
                          "danceability", "energy", "valence", "acousticness", "instrumentalness", 
                          "tempo_x", "loudness", "speechiness", "liveness", "beat_strength",
                          "time_signature", "spectral_centroid", "spectral_bandwidth", 
                          "spectral_rolloff", "zero_crossing_rate", "chroma_stft",
                          "harmonic_to_percussive_ratio", "speech_to_music_ratio"];
    
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    if (missingColumns.length > 0) {
      debugLog(`Warning: Missing columns: ${missingColumns.join(", ")}`, true);
      
      // For missing Track_Score, create it from popularity
      if (missingColumns.includes("Track_Score")) {
        debugLog("Creating Track_Score from popularity as a fallback", true);
        data.forEach(d => {
          d.Track_Score = +d.popularity; // Use popularity directly
        });
      }
    } else {
      debugLog("All required columns found in the dataset");
    }
    
    // Convert numeric values for all the requested features
    data.forEach(function(d, i) {
      try {
        // Convert all the requested features to numeric values
        d.danceability = +d.danceability;
        d.energy = +d.energy;
        d.key = +d.key;
        d.loudness = +d.loudness;
        d.mode = +d.mode;
        d.speechiness = +d.speechiness;
        d.acousticness = +d.acousticness;
        d.instrumentalness = +d.instrumentalness;
        d.liveness = +d.liveness;
        d.valence = +d.valence;
        d.tempo_x = +d.tempo_x;
        d.time_signature = +d.time_signature;
        d.spectral_centroid = +d.spectral_centroid;
        d.spectral_bandwidth = +d.spectral_bandwidth;
        d.spectral_rolloff = +d.spectral_rolloff;
        d.zero_crossing_rate = +d.zero_crossing_rate;
        d.chroma_stft = +d.chroma_stft;
        d.beat_strength = +d.beat_strength;
        d.harmonic_to_percussive_ratio = +d.harmonic_to_percussive_ratio;
        d.speech_to_music_ratio = +d.speech_to_music_ratio;
        d.popularity = +d.popularity;
        
        // Calculate platform hit count
        d.platform_hit_count = 0;
        const platformHitColumns = Object.keys(d).filter(key => key.endsWith("_Hit"));
        d.platform_hit_count = platformHitColumns.filter(platform => d[platform] === "True").length;
        
        // If genre is missing, mark as 'Unknown'
        d.track_genre = d.track_genre || 'Unknown';
      } catch (e) {
        console.warn("Error processing data row:", e, d);
        debugLog(`Error processing row ${i}: ${e.message}`, true);
      }
    });

    console.log("Data processed, first row sample:", data[0]);
    debugLog("Data processed successfully");

    // Initialize visible data with all data
    let visibleData = [...data];
    
    // Initial filters
    let minPopularity = 72;
    let minPlatforms = 5;
    let selectedGenre = "All Genres";

    // Extract all unique genres for the dropdown
    const genres = ['All Genres'].concat([...new Set(data.map(d => d.track_genre))].sort());
    console.log("Unique genres found:", genres.length);
    debugLog(`Found ${genres.length} unique genres`);
    
    // Populate the genre dropdown
    d3.select("#genre-filter")
      .selectAll("option")
      .data(genres)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);

    // Define the dimensions for the parallel coordinates
    // More meaningful selection of dimensions focused on audio features
    const dimensions = [
      { name: "danceability", label: "Danceability", type: "linear" },
      { name: "energy", label: "Energy", type: "linear" },
      { name: "valence", label: "Valence", type: "linear" }, 
      { name: "acousticness", label: "Acousticness", type: "linear" },
      { name: "instrumentalness", label: "Instrumentalness", type: "log" },
      { name: "tempo_x", label: "Tempo", type: "linear" },
      { name: "loudness", label: "Loudness", type: "linear" },
      { name: "speechiness", label: "Speechiness", type: "linear" },
      { name: "liveness", label: "Liveness", type: "linear" },
      { name: "beat_strength", label: "Beat Strength", type: "linear" },
      { name: "time_signature", label: "Time Signature", type: "ordinal", values: [3, 4, 5] },
      { name: "spectral_centroid", label: "Spectral Centroid", type: "linear" },
      { name: "spectral_bandwidth", label: "Spectral Bandwidth", type: "linear" },
      { name: "spectral_rolloff", label: "Spectral Rolloff", type: "linear" },
      { name: "zero_crossing_rate", label: "Zero Crossing Rate", type: "linear" },
      { name: "chroma_stft", label: "Chroma STFT", type: "linear" },
      { name: "harmonic_to_percussive_ratio", label: "Harm-Percus Ratio", type: "linear" },
      { name: "speech_to_music_ratio", label: "Speech-Music Ratio", type: "linear" }
    ];

    console.log("Dimensions defined:", dimensions.length);
    debugLog(`Created ${dimensions.length} dimensions for the visualization`);

    // Build scales for each dimension
    const y = {};
    dimensions.forEach(dimension => {
      try {
        if (dimension.type === "linear") {
          y[dimension.name] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[dimension.name]))
            .range([height, 0]);
          console.log(`Scale for ${dimension.name} created, domain:`, d3.extent(data, d => +d[dimension.name]));
        } else if (dimension.type === "log") {
          // Special handling for instrumentalness to avoid values going off chart
          if (dimension.name === "instrumentalness") {
            // Make sure very small values are visible by using a custom domain
            const minValue = Math.max(0.00001, d3.min(data, d => +d[dimension.name] || 0.00001));
            // Cap the max value to avoid extreme outliers
            const maxValue = Math.min(0.9, d3.max(data, d => +d[dimension.name]));
            
            y[dimension.name] = d3.scaleLog()
              .domain([minValue, maxValue])
              .range([height, 0])
              .clamp(true); // Clamp values to prevent going off scale
            
            console.log(`Adjusted log scale for ${dimension.name} created, domain:`, [minValue, maxValue]);
          } else {
            // Adding a small value to avoid log(0)
            const minValue = Math.max(0.00001, d3.min(data, d => +d[dimension.name] || 0.00001));
            y[dimension.name] = d3.scaleLog()
              .domain([minValue, d3.max(data, d => Math.max(minValue, +d[dimension.name] || minValue))])
              .range([height, 0]);
            console.log(`Log scale for ${dimension.name} created, domain:`, [minValue, d3.max(data, d => Math.max(minValue, +d[dimension.name] || minValue))]);
          }
        } else if (dimension.type === "ordinal") {
          const values = dimension.values || [...new Set(data.map(d => +d[dimension.name]))].sort();
          y[dimension.name] = d3.scalePoint()
            .domain(values)
            .range([height, 0]);
          console.log(`Ordinal scale for ${dimension.name} created, domain:`, values);
        }
      } catch (e) {
        console.error(`Error building scale for ${dimension.name}:`, e);
        debugLog(`Error creating scale for ${dimension.name}: ${e.message}`, true);
        // Fallback to a simple linear scale
        y[dimension.name] = d3.scaleLinear().domain([0, 1]).range([height, 0]);
      }
    });

    // Build the X scale -> it finds the best position for each Y axis
    const x = d3.scalePoint()
      .range([0, width])
      .domain(dimensions.map(d => d.name));

    console.log("X scale created with domain:", dimensions.map(d => d.name));
    debugLog("Created scales for all dimensions");

    // Function to generate the path for a data point
    function path(d) {
      return d3.line()(dimensions.map(p => {
        try {
          let value = d[p.name];
          
          // Handle special cases
          if (p.type === "log" && (+value <= 0 || isNaN(+value))) {
            value = 0.00001; // Default to a small value for log scale when value is 0 or NaN
          }
          
          return [x(p.name), y[p.name](value)];
        } catch (e) {
          console.warn(`Error generating path for ${p.name}:`, e);
          debugLog(`Error in path generation for ${p.name}: ${e.message}`, true);
          return [x(p.name), height/2]; // Fallback to middle point
        }
      }));
    }

    try {
      // Add a dark background rectangle for better visualization that matches the site's background
      svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#121212") // Match the body background color exactly
        .attr("rx", 4)
        .lower();
        
      // Add grid lines
      svg.selectAll(".grid-line")
        .data(dimensions.map(d => d.name))
        .enter()
        .append("line")
        .attr("class", "grid-line")
        .attr("x1", d => x(d))
        .attr("y1", 0)
        .attr("x2", d => x(d))
        .attr("y2", height)
        .attr("stroke", "#2A2A2A") // Slightly lighter grid lines for subtle guidance
        .attr("stroke-width", 1)
        .lower();
        
      // Add background lines (removed entirely to avoid clutter)
      
      // Define a brighter color scale for lines to stand out against dark background
      const color = d3.scaleOrdinal()
        .range([
          "#1ED760", // Brighter Spotify green
          "#FF47C3", // Brighter pink
          "#70B5FF", // Brighter blue
          "#FFE566", // Brighter yellow
          "#FF6B8B", // Brighter red
          "#2EFA74", // Even brighter green
          "#9277FF", // Brighter purple
          "#FFB94F", // Brighter orange
          "#4496FF", // Brighter blue
          "#E665FF"  // Brighter purple
        ]);

      // Add foreground lines with improved colors
      const foreground = svg.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(data)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", "line")
        .attr("stroke", d => color(d.track_genre))
        .attr("stroke-width", 1.8) // Slightly thicker lines
        .attr("fill", "none")
        .attr("opacity", 0.85) // Higher opacity for better visibility
        .attr("data-genre", d => d.track_genre)
        .attr("data-name", d => d.track_name);

      console.log("Foreground lines added with colors");
      debugLog(`Added ${data.length} colored lines for tracks`);

      // Add mouse events
      foreground.on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke-width", 4.5) // Even thicker on hover
          .attr("opacity", 1)
          .style("filter", "drop-shadow(0 0 5px rgba(255, 255, 255, 0.5))") // Add glow effect
          .raise();
          
        // Tooltip content
        let html = `
          <div class="song-title">${d.track_name}</div>
          <div>Artist: ${d.artists}</div>
          <div>Genre: ${d.track_genre}</div>
          <div>Popularity: ${d.popularity}</div>
          <div class="section-title">Audio Features</div>
          <div class="feature-grid">`;
          
        dimensions.forEach(dim => {
          html += `<div class="feature-item"><span class="feature-label">${dim.label}:</span> ${d[dim.name].toFixed(2)}</div>`;
        });
        
        html += `</div>`;
        
        tooltip.transition()
          .duration(200)
          .style("opacity", .9);
        tooltip.html(html)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke-width", 1.8)
          .attr("opacity", 0.85)
          .style("filter", "none") // Remove glow effect
          
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });

      console.log("Added mouse events to lines");
      debugLog("Added interactive mouse events");

      // Add a group element for each dimension.
      const g = svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d.name)},0)`);

      console.log("Created dimension groups");
      debugLog("Created dimension groups for axes");

      // Add axes and titles for each dimension
      g.append("g")
        .attr("class", "axis")
        .each(function(d) { 
          d3.select(this).call(d3.axisLeft(y[d.name])); 
        })
        .append("text")
        .attr("class", "axis-label")
        .attr("y", -10)
        .attr("x", 0)
        .style("text-anchor", "start")
        .style("fill", "#FFFFFF")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .text(d => d.label);

      console.log("Added axes and labels");
      debugLog("Added axis labels for each dimension");

      // Add click handler to the background to clear all brushes
      svg.append("rect")
        .attr("class", "background-rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .lower()
        .on("click", function() {
          g.selectAll(".brush").each(function(d) {
            d3.select(this).call(d3.brush().clear);
          });
          // Update the display
          updateFilters();
        });

      debugLog("Added background handler for clearing brushes");

      // Create a common brush function and store active brushes
      let actives = [];
      let extents = {};

      // Function to determine if a point should be displayed
      function filter(d) {
        if (d.popularity < minPopularity) return false;
        
        if (selectedGenre !== "All Genres" && d.track_genre !== selectedGenre) return false;
        
        // Use the pre-calculated platform hit count instead of calculating it each time
        if (d.platform_hit_count < minPlatforms) return false;
        
        return actives.every(function(p) {
          // Get the dimension type and value
          const dim = dimensions.find(dim => dim.name === p.name);
          let value = d[p.name];
          
          // Handle special case for log scale
          if (dim.type === "log" && (+value <= 0 || isNaN(+value))) {
            value = 0.00001;
          }
          
          // For ordinal scales, we need to check if the value is directly in the extent
          if (dim.type === "ordinal") {
            // Get position for this value
            const pos = y[p.name](value);
            // Check if the position is within the brush extent
            return extents[p.name][0] <= pos && pos <= extents[p.name][1];
          }
          
          // For other scales, check if the value is in range
          return extents[p.name][0] <= value && value <= extents[p.name][1];
        });
      }

      // Function to update filter selections and display
      function updateFilters() {
        // Find active dimensions (those with brushes)
        actives = [];
        extents = {};
        
        g.selectAll(".brush")
          .filter(function() {
            return d3.brushSelection(this);
          })
          .each(function(d) {
            actives.push(d);
            
            // Get the brush selection (in pixels)
            const selection = d3.brushSelection(this);
            
            // Convert the brush selection from pixels to data domain values
            if (d.type === "ordinal") {
              // For ordinal scales we keep the pixel values to check positions
              extents[d.name] = selection;
            } else {
              // For numeric scales convert to domain values
              extents[d.name] = selection.map(y[d.name].invert, y[d.name]);
              // Ensure min is before max
              if (extents[d.name][0] > extents[d.name][1]) {
                extents[d.name] = [extents[d.name][1], extents[d.name][0]];
              }
            }
          });
        
        // Filter the data based on all active filters
        foreground.style("display", d => filter(d) ? null : "none");
        
        // Update the count display
        const visibleCount = data.filter(filter).length;
        d3.select("#song-count").text(visibleCount);
        
        // Add special highlight to axes that have active brushes
        g.selectAll(".dimension")
          .classed("active-axis", false);
        
        // Add active-axis class to both the axis and its label
        actives.forEach(dimension => {
          g.selectAll(".dimension")
            .filter(d => d.name === dimension.name)
            .classed("active-axis", true)
            .selectAll(".axis-label")
            .style("fill", "#1DB954") // Use Spotify green for active dimensions
            .style("font-weight", "bold");
        });
        
        // Reset non-active axis labels
        g.selectAll(".dimension")
          .filter(d => !actives.some(active => active.name === d.name))
          .selectAll(".axis-label")
          .style("fill", "#FFFFFF") // White for regular labels
          .style("font-weight", "normal");
      }

      // Function to handle brush events
      function brushed(event, d) {
        // Mark this dimension as active (for styling)
        const isActive = !!event.selection;
        d3.select(this.parentNode)
          .classed("active-axis", isActive);
        
        // Also highlight the axis label
        d3.select(this.parentNode)
          .select(".axis-label")
          .style("fill", isActive ? "#1DB954" : "#FFFFFF") // Spotify green for active, white for inactive
          .style("font-weight", isActive ? "bold" : "normal");
        
        updateFilters();
      }

      // Apply brushes
      g.append("g")
        .attr("class", "brush")
        .each(function(d) {
          d3.select(this).call(
            d3.brushY()
              .extent([[-10, 0], [10, height]])
              .on("start brush end", brushed)
          );
        })
        .selectAll("rect")
        .attr("x", -8)
        .attr("width", 16);

      debugLog("Added brushes to each dimension");

      // Add double-click to clear individual brush
      g.selectAll(".brush")
        .on("dblclick", function(event, d) {
          event.preventDefault();
          event.stopPropagation();
          d3.select(this).call(d3.brush().clear);
          d3.select(this.parentNode).classed("active-axis", false);
          updateFilters();
        });

      // Add helper text for brushes
      svg.append("text")
        .attr("class", "brush-help")
        .attr("x", width / 2)
        .attr("y", height + 30)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#777")
        .text("Double-click on an axis to clear its filter");

      // Add popularity color legend instead of genre legend
      const legendWidth = 20;
      const legendHeight = 200;

      // Create legend container
      const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width + 40}, 20)`);
      
      // Add legend title
      legend.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", -10)
        .style("text-anchor", "start")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#FFFFFF") // White text for visibility
        .text("Popularity");
      
      // Create gradient for legend with Spotify colors
      const defs = svg.append("defs");
      const linearGradient = defs.append("linearGradient")
        .attr("id", "popularity-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");
      
      // Add color stops with vibrant Spotify colors
      linearGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#2EFA74"); // Brighter green
        
      linearGradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#70B5FF"); // Brighter blue
        
      linearGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#F230AA"); // Pink
      
      // Draw legend rectangle with gradient
      legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#popularity-gradient)")
        .style("stroke", "#444444") // Darker border
        .style("stroke-width", 1);
      
      // Add axis ticks to legend
      const legendScale = d3.scaleLinear()
        .domain([70, 100]) // Popularity range is 70-100
        .range([legendHeight, 0]);
      
      const legendAxis = d3.axisRight(legendScale)
        .ticks(5);
      
      legend.append("g")
        .attr("transform", `translate(${legendWidth}, 0)`)
        .call(legendAxis)
        .selectAll("text")
        .style("fill", "#E0E0E0"); // Light gray for visibility

      debugLog("Added popularity color legend");
    } catch (e) {
      console.error("Error during visualization creation:", e);
      debugLog(`Error creating visualization: ${e.message}`, true);
    }

    // Update filters when controls change
    d3.select("#popularity-slider").on("input", function() {
      minPopularity = +this.value;
      d3.select("#popularity-value").text(`Current: ${minPopularity}`);
      updateFilters();
    });
    
    d3.select("#platforms-filter").on("change", function() {
      minPlatforms = +this.value;
      
      // Check if there are any tracks that match this platform count
      const tracksWithPlatformCount = data.filter(d => d.platform_hit_count >= minPlatforms);
      
      if (tracksWithPlatformCount.length === 0) {
        console.warn(`No tracks found with ${minPlatforms} or more platforms`);
        alert(`No tracks found with ${minPlatforms} or more platforms. Resetting to 5.`);
        minPlatforms = 5;
        d3.select("#platforms-filter").property("value", "5");
      }
      
      updateFilters();
    });

    // Make sure platforms filter starts at 5
    d3.select("#platforms-filter").property("value", "5");
    
    d3.select("#genre-filter").on("change", function() {
      selectedGenre = this.value;
      updateFilters();
    });

    // Reset filter button functionality
    d3.select("#reset-button").on("click", function() {
      // Remove all brush selections by directly manipulating the DOM
      svg.selectAll(".brush").each(function() {
        d3.select(this).call(d3.brush().clear);
      });
      
      // Reset dropdown and slider to defaults
      d3.select("#genre-filter").property("value", "All Genres");
      selectedGenre = "All Genres";
      
      d3.select("#platforms-filter").property("value", "5");
      minPlatforms = 5;
      
      d3.select("#popularity-slider").property("value", 72);
      minPopularity = 72;
      d3.select("#popularity-value").text("Current: 72");
      
      // Reset the active brushes and extents
      actives = [];
      extents = {};
      
      // Remove active-axis class from all dimensions
      svg.selectAll(".dimension").classed("active-axis", false);
      
      // Reset all axis labels to normal style
      svg.selectAll(".axis-label")
        .style("fill", "#FFFFFF")
        .style("font-weight", "normal");
      
      // Update visualization
      updateFilters();
    });
    
    // Initialize with default filters
    updateFilters();
    
    // Add console message to confirm visualization loaded successfully
    console.log("Visualization loaded successfully with", data.length, "data points");
    debugLog(`Visualization initialization complete with ${data.length} data points`);
  })
  .catch(handleError);