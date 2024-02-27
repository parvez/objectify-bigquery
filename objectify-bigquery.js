var MAX_LOOKUP_LEVEL = 20;
// Initialize empty objects to store key-value pairs
var finalData = {};

// Cache setup for external references
var externalReferences = {};

// Function to make an XMLHttpRequest and return a Promise
function makeRequest(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    resolve(xhr.responseText);
                } else {
                    reject(new Error('Failed to fetch data from ' + url));
                }
            }
        };
        xhr.open("GET", url, true);
        xhr.send();
    });
}

// Recursive function to process data and update objects
async function processRecursiveData(level, rows, obj) {
  // Use for...of loop with async/await for sequential processing
    for (const row of rows) {
        // Extract the field, type, link, and description values
        var field = row.querySelector('td:first-child code').textContent.trim();
        var typeElement = row.querySelector('td:last-child p:first-child code');
        var type = typeElement ? typeElement.textContent.trim().replace(/\([^)]*\)/, '').trim() : null;

        // Extract link information if it exists in the type element
        var linkElement = typeElement ? typeElement.querySelector('a') : null;
        var link = linkElement ? linkElement.getAttribute('href') : null;
        var linkText = linkElement ? linkElement.textContent.trim() : null;

        var descriptionElement = row.querySelector('td:last-child p:last-child');
        var description = 'No description available';
        if (descriptionElement) {
          description = descriptionElement.textContent.trim();
        }

        // Determine the object to update based on the description
        if (!obj.outputOnly) obj.outputOnly = {};
        if (!obj.other) obj.other = {};

        var objToUpdate = description.includes('Output only') ? obj.outputOnly : obj.other;

        // Add the key-value pair directly to the objToUpdate
        objToUpdate[field] = { type: type, link: link, linkText: linkText, description: description };

        // Further processing or actions after data processing
        // console.log("Data processing complete for Object:", objToUpdate);

        // Check if there is a link for recursion
        if (link && linkText) {
            // Initialize a nested object if not present
            objToUpdate[field][linkText] = {};

            // Check if enum or object to help with lookup corresponding table
            var lookupType = (type === 'enum' ? 'ENUM_VALUES' : 'FIELDS');
            var subrows = document.querySelectorAll(`#${linkText}\\.${lookupType}-table tbody tr`);
            if (!subrows.length) {

                if (link.startsWith('/')) {

                    // check if dom exists in cache
                    if (externalReferences[linkText]) {
                        console.log('load dom from cache', linkText, link);
                        subrows = externalReferences[linkText];
                    } else {
                        console.log('make external call for', linkText, link);
                        // Make a request to fetch data from the linked URL
                        var htmlString = await makeRequest(link);
                        // Create a temporary HTML document
                        var parser = new DOMParser();
                        var temporaryDocument = parser.parseFromString(htmlString, 'text/html');

                        // Use querySelectorAll on the temporary document
                        if (link.includes('#')) {
                            subrows = temporaryDocument.querySelectorAll(`#${linkText}\\.${lookupType}-table tbody tr`);
                        } else {
                            subrows = temporaryDocument.querySelectorAll(`#${lookupType}-table tbody tr`);
                        }
                        externalReferences[linkText] = subrows;
                    }

                }

            }
            // Recursively process linked data. Max 2 level deep
            if (level <= MAX_LOOKUP_LEVEL) {
                await processRecursiveData(++level, subrows, objToUpdate[field][linkText]);
            }
        }
    }
}

// Get the table rows from the tbody
var rows = document.querySelectorAll('#FIELDS-table tbody tr');

// Use the recursive function to process data
await processRecursiveData(1, rows, finalData);

// Log the resulting objects
console.log("Object:", finalData);
