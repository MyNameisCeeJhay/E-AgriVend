// config.js
const getApiUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  return 'https://e-agrivend.onrender.com/api';
};

const getSocketUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return 'https://e-agrivend.onrender.com';
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();

export default { API_URL, SOCKET_URL };