const audio = require('./services/audio-service');
App({ onHide() { audio.stop(); } });
