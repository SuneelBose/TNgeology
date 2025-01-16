document.getElementById('loginForm').addEventListener('submit', function(event) {
  event.preventDefault();
  
  // Example credentials
  const username = 'geotech';
  const password = 'geotech@123';
  
  // Get values from form
  const inputUsername = document.getElementById('username').value;
  const inputPassword = document.getElementById('password').value;
  
  if (inputUsername === username && inputPassword === password) {
    // Set session storage to indicate the user is logged in
    sessionStorage.setItem('isLoggedIn', 'true');
    
    // Redirect to the dashboard (geology.html)
    window.location.href = 'geology.html';
  } else {
    // Show error message and red background
    document.body.classList.add('error');
    const errorMessage = document.createElement('div');
    errorMessage.classList.add('error-message');
    errorMessage.textContent = 'Wrong credentials. Please try again.';
    document.querySelector('.container').prepend(errorMessage);
  }
});
