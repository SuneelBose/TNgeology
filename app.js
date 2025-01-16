let map;
let geologyData = {}; // Placeholder for geology.json data
let allGeoJSONLayer = null; // To hold the full GeoJSON layer for all features
let currentDistrictFilter = 'none'; // To track the current district filter
let currentCategoryFilter = 'none'; // To track the current category filter

// Map to store the generated colors for INDEX_LEGE values
let indexColorMap = {};

// Generate a vibrant, distinct color based on INDEX_LEGE
function generateStaticColor(indexLege) {
  if (!indexColorMap[indexLege]) {
    const hash = indexLege.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 400;
    const saturation = 100 + (hash % 25);
    const lightness = 30 + (hash % 25);
    indexColorMap[indexLege] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  return indexColorMap[indexLege];
}

// Initialize Leaflet Map
function initMap() {
  map = L.map('map').setView([10.7786, 78.4917], 10); // Default center for India
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; Suneel Bose </a> contributors'
  }).addTo(map);
}

// Load TNBoundary data from GeoServer WFS
function loadTNBoundaryData() {
  $.ajax({
    url: 'http://51.20.118.74:8080/geoserver/wfs',
    type: 'GET',
    data: {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typename: 'Horticulture:TNboundry', // Modify with the correct layer name from GeoServer
      srsname: 'EPSG:4326',
      outputFormat: 'application/json',
    },
    dataType: 'json',
    success: function(data) {
      tnBoundaryData = data; // Use the data returned by WFS
      displayTotalArea();

      // Add TNBoundary GeoJSON layer to the map with black border and transparent fill
      L.geoJSON(tnBoundaryData, {
        style: function (feature) {
          return {
            color: 'Black', // Black border
            weight: 3, // Border width
            fillOpacity: 0 // Transparent fill
          };
        }
      }).addTo(map);
    },
    error: function(xhr, status, error) {
      console.error("Error loading TNBoundary WFS data:", error);
    }
  });
}

// Load the Geology data from WFS
function loadGeologyData() {
  $.ajax({
    url: 'http://51.20.118.74:8080/geoserver/wfs',
    type: 'GET',
    data: {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typename: 'Horticulture:geology',
      srsname: 'EPSG:4326',
      outputFormat: 'application/json',
    },
    dataType: 'json',
    success: function(data) {
      geologyData = data; // Use the data returned by WFS
      populateDistrictFilter();
      drawBarChart();
      updateGeoJSONLayer(geologyData.features); // Load all features to the map
    },
    error: function(xhr, status, error) {
      console.error("Error loading WFS data:", error);
    }
    
  });
  loadTNBoundaryData();
}

// Populate district filter dropdown
function populateDistrictFilter() {
  const districtFilter = document.getElementById('districtFilter');
  
  // Clear any existing options
  districtFilter.innerHTML = '';

  // Create and append 'None' option (initially select "None" for all features)
  const noneOption = document.createElement('option');
  noneOption.value = 'none';
  noneOption.textContent = 'None';
  districtFilter.appendChild(noneOption);

  // Create and append options for each district
  const districts = new Set(geologyData.features.map(feature => feature.properties.DISTRICT));
  districts.forEach(district => {
    const option = document.createElement('option');
    option.value = district;
    option.textContent = district;
    districtFilter.appendChild(option);
  });

  // Set the initial value to 'none'
  districtFilter.value = 'none';

  // Attach event listener to filter by district
  districtFilter.addEventListener('change', filterByDistrict);

  // Trigger initial "none" selection to show all features on map
  filterByDistrict({ target: { value: 'none' } });
}

// Filter by selected district and update map and legend
function filterByDistrict(event) {
  const selectedDistrict = event.target.value;

  // Reset legends to 'none' when the district filter changes
  currentCategoryFilter = 'none'; // Reset category filter
  populateLegends('none'); // Reset legends filter to "none"

  // If the same district is selected again, reset the filters
  if (selectedDistrict === currentDistrictFilter) {
    resetFilters();
  } else {
    currentDistrictFilter = selectedDistrict; // Update the current district filter
  }

  // Apply the filter based on the district selection
  if (currentDistrictFilter === 'none') {
    // Show all features and categories when "None" is selected
    const filteredData = geologyData.features.filter(feature => {
      return currentCategoryFilter === 'none' || feature.properties.CATEGORY === currentCategoryFilter;
    });
    updateGeoJSONLayer(filteredData);
    map.fitBounds(allGeoJSONLayer.getBounds());
    populateLegends('none'); // Show legends for all categories
  } else {
    // Filter data by district and category
    const filteredData = geologyData.features.filter(feature => {
      const districtMatches = feature.properties.DISTRICT === currentDistrictFilter;
      const categoryMatches = currentCategoryFilter === 'none' || feature.properties.CATEGORY === currentCategoryFilter;
      return districtMatches && categoryMatches;
    });
    updateGeoJSONLayer(filteredData);
    zoomToFilteredData(filteredData);
    populateLegends(currentDistrictFilter); // Show legends for the selected district
  }

  displayTotalArea(currentDistrictFilter);
  drawPieChart(currentDistrictFilter);
}

// Update GeoJSON layer on map with static color based on INDEX_LEGE
function updateGeoJSONLayer(data) {
  if (allGeoJSONLayer) {
    // Instead of removing and adding the layer, toggle its visibility
    allGeoJSONLayer.clearLayers(); // Clear the existing features
    allGeoJSONLayer.addData(data); // Add the new data to the layer
  } else {
    // If the layer doesn't exist, create it
    allGeoJSONLayer = L.geoJSON(data, {
      style: feature => {
        const indexLege = feature.properties.INDEX_LEGE;
        const color = generateStaticColor(indexLege);
        return { color, weight: 2, fillOpacity: 0.7 };
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => zoomToFeature(layer));
        layer.bindPopup(`<b>District:</b> ${feature.properties.DISTRICT}<br><b>Area:</b> ${feature.properties.AREA_HA} HA<br><b>Index Leg:</b> ${feature.properties.INDEX_LEGE}`);
      }
    }).addTo(map);
  }
}

// Zoom to selected features
function zoomToFeature(layer) {
  map.fitBounds(layer.getBounds());
}

// Zoom to the bounds of the filtered data
function zoomToFilteredData(filteredData) {
  const bounds = L.geoJSON(filteredData).getBounds();
  map.fitBounds(bounds);
}

// Display total area of selected district or all features
function displayTotalArea(district = 'none') {
  let totalArea = 0;
  let districtName = 'Tamil Nadu'; // Default district name for when none is selected

  if (district === 'none') {
    totalArea = tnBoundaryData.features.reduce((acc, feature) => acc + feature.properties.AREA_HA, 0);
  } else {
    const filteredData = tnBoundaryData.features.filter(feature => feature.properties.DISTRICT === district);
    totalArea = filteredData.reduce((acc, feature) => acc + feature.properties.AREA_HA, 0);
    districtName = district; // Update district name if a district is selected
  }

  document.getElementById('areaDisplay').innerHTML = `${districtName}  Area: <br>${totalArea.toFixed(2)} Hectares`;
}

// Populate legends based on the selected district
function populateLegends(district) {
  const legendsContainer = document.getElementById('legends');
  legendsContainer.innerHTML = ''; // Clear existing legends

  let categories = [];
  if (district === 'none') {
    categories = [...new Set(geologyData.features.map(feature => feature.properties.CATEGORY))];
  } else {
    const filteredData = geologyData.features.filter(feature => feature.properties.DISTRICT === district);
    categories = [...new Set(filteredData.map(feature => feature.properties.CATEGORY))];
  }

  categories.forEach(category => {
    const legendItem = document.createElement('div');
    legendItem.classList.add('category-legend');
    legendItem.style.backgroundColor = generateStaticColor(category);
    legendItem.textContent = category;

    // Add event listener to filter map by category and update pie chart
    legendItem.addEventListener('click', () => {
      filterByCategory(category); // Update the map
      drawPieChart(district, category); // Update the pie chart with the selected district and category
    });

    legendsContainer.appendChild(legendItem);
  });
}

// Filter and display features based on selected category from legends
function filterByCategory(category) {
  currentCategoryFilter = category; // Update the category filter

  if (currentDistrictFilter === 'none') {
    // Show all features with selected category if no district filter is applied
    const filteredData = geologyData.features.filter(feature => feature.properties.CATEGORY === category);
    updateGeoJSONLayer(filteredData);
    map.fitBounds(allGeoJSONLayer.getBounds());
    displayTotalArea('none');
  } else {
    // Show only features with selected category and district
    const filteredData = geologyData.features.filter(feature => 
      feature.properties.CATEGORY === category && feature.properties.DISTRICT === currentDistrictFilter
    );
    updateGeoJSONLayer(filteredData);
    zoomToFilteredData(filteredData);
    displayTotalArea(currentDistrictFilter);
  }
}

// Function to handle the drawing of pie chart
let pieChart = null; // Variable to hold the chart instance

function drawPieChart(district = 'none', category = 'none') {
  const ctx = document.getElementById('pieChart').getContext('2d');
  let categoryData = {};

  console.log("Selected district:", district); // Log the selected district
  console.log("Selected category:", category); // Log the selected category

  // Aggregate data based on category and district
  if (district === 'none' && category === 'none') {
    // No filters, show all data
    geologyData.features.forEach((feature) => {
      const cat = feature.properties.CATEGORY;
      categoryData[cat] = (categoryData[cat] || 0) + feature.properties.AREA_HA;
    });
  } else {
    geologyData.features
      .filter((feature) => {
        // Filter based on category and district
        const matchesCategory = category === 'none' || feature.properties.CATEGORY === category;
        const matchesDistrict = district === 'none' || feature.properties.DISTRICT === district;
        return matchesCategory && matchesDistrict;
      })
      .forEach((feature) => {
        const cat = feature.properties.CATEGORY;
        categoryData[cat] = (categoryData[cat] || 0) + feature.properties.AREA_HA;
      });
  }

  console.log("Aggregated data for the pie chart:", categoryData);

  // If no data matches, return and stop drawing the chart
  if (Object.keys(categoryData).length === 0) {
    console.log("No data for the selected filters.");
    return; // Exit early if no data to show
  }

  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);
  const colors = labels.map((label) => generateStaticColor(label));

  // Destroy the old chart instance if it exists
  if (pieChart) {
    pieChart.destroy();
  }

  // Create a new pie chart
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Area in Hectares',
          data: data,
          backgroundColor: colors,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false // Disable default legend display in pie chart
        }
      }
    }
  });

  // Call to create and update legends below the pie chart
  updateLegends(labels, data, colors);
}

// Updated function to create legends below the pie chart without percentage
function updateLegends(labels, data, colors) {
  const legendsContainer = document.getElementById('Chartlegend');
  legendsContainer.innerHTML = ''; // Clear existing legends

  labels.forEach((label, index) => {
    const area = data[index];

    // Create legend item
    const legendItem = document.createElement('div');
    legendItem.classList.add('category-legend');
    legendItem.style.display = 'flex';
    legendItem.style.alignItems = 'center';
    legendItem.style.marginBottom = '10px';
    
    // Create colored box for the category
    const colorBox = document.createElement('span');
    colorBox.classList.add('legend-color-box');
    colorBox.style.backgroundColor = colors[index];
    colorBox.style.width = '15px';
    colorBox.style.height = '15px';
    colorBox.style.marginRight = '10px'; // Adjust margin
    
    // Create text for the legend (show only category and area)
    const legendText = document.createElement('span');
    legendText.classList.add('legend-text');
    legendText.textContent = `${label} - ${area.toFixed(2)} Hectares`; // Removed percentage

    // Append elements to legend item
    legendItem.appendChild(colorBox);
    legendItem.appendChild(legendText);
    legendsContainer.appendChild(legendItem);
  });
}

// Reset filters if same district/category is selected again
function resetFilters() {
  currentCategoryFilter = 'none'; // Reset category filter
  populateLegends('none'); // Reset legends filter to "none"
  updateGeoJSONLayer(geologyData.features); // Reset map to show all features
  map.fitBounds(allGeoJSONLayer.getBounds()); // Adjust map to fit all data
  displayTotalArea('none'); // Reset total area display
  drawPieChart('none'); // Reset pie chart display
}

// Initialize map and load data once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadGeologyData();
});

// Check if the user is logged in
if (!sessionStorage.getItem('isLoggedIn')) {
  // If not logged in, redirect to login page
  window.location.href = 'index.html';
}

