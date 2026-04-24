// config.js - Use environment variables
export const API_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : 'https://e-agrivend.onrender.com/api');

export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://e-agrivend.onrender.com');

console.log('🔧 Config loaded:');
console.log('   API_URL:', API_URL);
console.log('   SOCKET_URL:', SOCKET_URL);

export default { API_URL, SOCKET_URL };