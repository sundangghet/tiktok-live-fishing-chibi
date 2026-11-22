const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const DEFAULT_TIKTOK_ID = (process.env.TIKTOK_UNIQUE_ID || '').replace(/^@/, '').trim();

app.use(express.static(path.join(__dirname, 'public')));

let currentConnection = null;
let activeUniqueId = DEFAULT_TIKTOK_ID || null;
let connectionStatus = 'disconnected';
let lastErrorMessage = '';

function cleanupConnection() {
  if (currentConnection) {
    try {
      currentConnection.removeAllListeners();
      currentConnection.disconnect();
    } catch (err) {
      console.error('Lỗi khi ngắt kết nối cũ:', err.message);
    }
    currentConnection = null;
  }
}

function broadcastState() {
  io.emit('tiktok_status', {
    status: connectionStatus,
    uniqueId: activeUniqueId,
    error: lastErrorMessage
  });
}

function connectToTikTok(rawId) {
  const uniqueId = (rawId || '').replace(/^@/, '').trim();
  if (!uniqueId) {
    connectionStatus = 'disconnected';
    activeUniqueId = null;
    lastErrorMessage = 'Vui lòng nhập TikTok ID (không cần dấu @).';
    broadcastState();
    return;
  }

  cleanupConnection();
  activeUniqueId = uniqueId;
  connectionStatus = 'connecting';
  lastErrorMessage = '';
  broadcastState();

  console.log(`[TikTok] Đang kết nối tới @${uniqueId}...`);

  const tiktokLive = new WebcastPushConnection(uniqueId, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 1800
  });

  currentConnection = tiktokLive;

  tiktokLive.connect().then((state) => {
    if (currentConnection !== tiktokLive) return;
    connectionStatus = 'connected';
    lastErrorMessage = '';
    console.log(`[TikTok] Đã kết nối thành công tới @${uniqueId} (Room ID: ${state.roomId})`);
    broadcastState();
  }).catch((err) => {
    if (currentConnection !== tiktokLive) return;
    connectionStatus = 'error';
    lastErrorMessage = err && err.message ? err.message : 'Không thể kết nối tới phiên Live.';
    console.error(`[TikTok] Lỗi kết nối @${uniqueId}:`, lastErrorMessage);
    broadcastState();
  });

  // 1. Sự kiện chat bình luận
  tiktokLive.on('chat', (data) => {
    const comment = (data.comment || '').trim();
    const nickname = data.nickname || data.uniqueId || 'Đạo Hữu';
    const uid = data.uniqueId || '';

    io.emit('tiktok_event', {
      type: 'chat',
      user: nickname,
      uniqueId: uid,
      comment,
      avatar: data.profilePictureUrl || '',
      timestamp: Date.now()
    });
  });

  // 2. Sự kiện thả tim (like)
  tiktokLive.on('like', (data) => {
    const count = Number(data.likeCount) || 1;
    const nickname = data.nickname || data.uniqueId || 'Đạo Hữu';

    io.emit('tiktok_event', {
      type: 'like',
      user: nickname,
      uniqueId: data.uniqueId || '',
      count,
      totalLike: data.totalLikeCount || 0,
      timestamp: Date.now()
    });
  });

  // 3. Sự kiện quà tặng (gift)
  // Lưu ý: Với quà có streak (như Hoa Hồng), chỉ tính khi repeatEnd === true hoặc giftType !== 1
  tiktokLive.on('gift', (data) => {
    const isStreakGift = data.giftType === 1;
    if (isStreakGift && !data.repeatEnd) {
      return;
    }

    const repeatCount = Number(data.repeatCount) || 1;
    const diamondCount = Number(data.diamondCount) || 1;
    const totalDiamonds = diamondCount * repeatCount;
    const giftName = data.giftName || 'Quà Tiên Giới';
    const nickname = data.nickname || data.uniqueId || 'Đạo Hữu';

    io.emit('tiktok_event', {
      type: 'gift',
      user: nickname,
      uniqueId: data.uniqueId || '',
      giftId: data.giftId || 0,
      giftName,
      repeatCount,
      diamondCount,
      totalDiamonds,
      giftPictureUrl: data.giftPictureUrl || '',
      timestamp: Date.now()
    });
  });

  tiktokLive.on('streamEnd', () => {
    if (currentConnection !== tiktokLive) return;
    connectionStatus = 'disconnected';
    lastErrorMessage = 'Phiên Live đã kết thúc.';
    console.log(`[TikTok] Phiên Live @${uniqueId} đã kết thúc.`);
    broadcastState();
  });

  tiktokLive.on('error', (err) => {
    if (currentConnection !== tiktokLive) return;
    lastErrorMessage = err && err.message ? err.message : 'Lỗi đường truyền TikTok.';
    console.error('[TikTok] Stream error:', lastErrorMessage);
    broadcastState();
  });
}

io.on('connection', (socket) => {
  socket.emit('tiktok_status', {
    status: connectionStatus,
    uniqueId: activeUniqueId,
    error: lastErrorMessage
  });

  socket.on('connect_tiktok', (payload) => {
    const id = typeof payload === 'string' ? payload : (payload && payload.uniqueId);
    connectToTikTok(id);
  });

  socket.on('disconnect_tiktok', () => {
    cleanupConnection();
    connectionStatus = 'disconnected';
    lastErrorMessage = '';
    broadcastState();
  });
});

server.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
  if (DEFAULT_TIKTOK_ID) {
    connectToTikTok(DEFAULT_TIKTOK_ID);
  }
});
