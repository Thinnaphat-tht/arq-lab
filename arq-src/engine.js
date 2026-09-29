/* ARQ engine: pure logic, no DOM. Used by the page (inlined) and by node tests. */
function windowSizes(mode, m) {
  if (mode === 'sw') return { M: 2, ws: 1, wr: 1 };
  var M = Math.pow(2, m);
  if (mode === 'gbn') return { M: M, ws: M - 1, wr: 1 };
  return { M: M, ws: M / 2, wr: M / 2 };
}

function createSim(cfg) {
  var D = cfg.D || 3, TO = cfg.TO || 8, maxT = cfg.maxT || 300;
  var mode = cfg.mode, N = cfg.N;
  var W = windowSizes(mode, cfg.m);
  var M = W.M, ws = W.ws, wr = W.wr;
  var rules = cfg.rules || [];

  var s = {
    cfg: cfg, M: M, ws: ws, wr: wr, D: D, TO: TO, N: N,
    t: -1, txs: [], log: [], timeouts: [], done: false, doneT: null,
    sender: { base: 0, next: 0, acked: [], lastSend: [], sentCount: [], queue: [] },
    recv: { expected: 0, buffer: [], delivered: 0 },
    stats: { frames: 0, retx: 0 },
    attempts: {}
  };
  for (var i = 0; i < N + 1; i++) {
    s.sender.acked.push(false); s.sender.lastSend.push(null); s.sender.sentCount.push(0);
    s.recv.buffer.push(false);
  }
  var sd = s.sender, rc = s.recv;

  function say(t, cls, text) { s.log.push({ t: t, cls: cls, text: text }); }

  function makeTx(kind, idx, sendT, retx) {
    var key = kind + idx;
    s.attempts[key] = (s.attempts[key] || 0) + 1;
    var attempt = s.attempts[key], extra = 0, lost = false;
    for (var k = 0; k < rules.length; k++) {
      var r = rules[k];
      if (r.kind === kind && r.idx === idx && r.attempt === attempt) {
        if (r.lose) lost = true;
        if (r.delay) extra += r.delay;
      }
    }
    var tx = { id: s.txs.length, kind: kind, idx: idx, num: idx % M, sendT: sendT, arriveT: sendT + D + extra,
      lost: lost, retx: !!retx, attempt: attempt, handled: false, delayed: extra };
    s.txs.push(tx);
    return tx;
  }

  function ack(idx, t) { makeTx('A', idx, t, false); }

  function recvFrame(tx, t) {
    var idx = tx.idx, n = tx.num;
    if (mode === 'sr') {
      if (idx >= rc.expected && idx < rc.expected + wr) {
        rc.buffer[idx] = true;
        if (idx !== rc.expected) say(t, '', 'ผู้รับได้ F' + n + ' มาก่อนคิว เก็บไว้ใน buffer แล้วรอ F' + (rc.expected % M));
        ack(idx, t);
        while (rc.buffer[rc.expected]) { rc.expected++; rc.delivered++; }
      } else if (idx < rc.expected) {
        say(t, '', 'ผู้รับได้ F' + n + ' ซ้ำ ทิ้งเฟรมนี้ แต่ตอบ ACK ' + n + ' อีกครั้ง');
        ack(idx, t);
      } else {
        say(t, 'bad', 'ผู้รับทิ้ง F' + n + ' เพราะอยู่นอก receive window');
      }
    } else if (idx === rc.expected) {
      rc.expected++; rc.delivered++;
      ack(rc.expected, t);
    } else if (idx < rc.expected) {
      say(t, '', 'ผู้รับได้ F' + n + ' ซ้ำ (ดูจากเลขลำดับ) ทิ้งเฟรมนี้ แต่ตอบ ACK ' + (rc.expected % M) + ' อีกครั้ง');
      ack(rc.expected, t);
    } else {
      say(t, 'bad', 'ผู้รับทิ้ง F' + n + ' เพราะมาผิดลำดับ (รอ F' + (rc.expected % M) + ', receive window = 1) และไม่ตอบอะไร');
    }
  }

  function recvAck(tx, t) {
    var n = tx.num;
    if (mode === 'sr') {
      if (tx.idx < N && !sd.acked[tx.idx]) {
        sd.acked[tx.idx] = true;
      } else {
        say(t, '', 'ผู้ส่งได้ ACK ' + n + ' ซ้ำ ไม่ทำอะไร');
      }
      while (sd.base < N && sd.acked[sd.base]) sd.base++;
    } else if (tx.idx > sd.base) {
      var jump = tx.idx - sd.base;
      for (var i = sd.base; i < tx.idx; i++) sd.acked[i] = true;
      sd.base = tx.idx;
      if (sd.next < sd.base) sd.next = sd.base;
      if (jump > 1) say(t, 'ok', 'ผู้ส่งได้ ACK ' + n + ' (cumulative) ยืนยัน ' + jump + ' เฟรมพร้อมกัน');
    } else {
      say(t, '', 'ผู้ส่งได้ ACK ' + n + ' เก่า (ช้า/ซ้ำ) ดูจากเลข ACK แล้วทิ้ง');
    }
    if (sd.base >= N && !s.done) { s.done = true; s.doneT = t; say(t, 'ok', 'ส่งครบทุกเฟรมและได้ ACK ครบแล้ว'); }
  }

  function checkTimeouts(t) {
    var i;
    if (mode === 'sr') {
      for (i = sd.base; i < Math.min(sd.next, N); i++) {
        if (!sd.acked[i] && sd.lastSend[i] !== null && sd.queue.indexOf(i) < 0 && sd.lastSend[i] + TO <= t) {
          sd.queue.push(i);
          s.timeouts.push({ t: t, idx: i });
          say(t, 'bad', 'timer ของ F' + (i % M) + ' หมดเวลา → ส่งใหม่เฉพาะ F' + (i % M));
        }
      }
    } else if (sd.base < sd.next && sd.base < N && sd.lastSend[sd.base] !== null && sd.lastSend[sd.base] + TO <= t) {
      var from = sd.base, to = sd.next - 1, list = [];
      for (i = from; i <= to; i++) list.push('F' + (i % M));
      s.timeouts.push({ t: t, idx: from });
      if (mode === 'sw') say(t, 'bad', 'timeout: ไม่ได้ ACK ของ F' + (from % M) + ' → ส่ง F' + (from % M) + ' ซ้ำ');
      else say(t, 'bad', 'timeout ที่เฟรมเก่าสุด F' + (from % M) + ' → ย้อนกลับ ส่งใหม่ ' + list.join(', ') + ' (' + list.length + ' เฟรม)');
      sd.next = from;
    }
  }

  function sendPhase(t) {
    if (s.done) return;
    var idx = null;
    if (mode === 'sr') {
      while (sd.queue.length && idx === null) {
        var q = sd.queue.shift();
        if (!sd.acked[q]) idx = q;
      }
    }
    if (idx === null && sd.next < N && sd.next - sd.base < ws) { idx = sd.next; sd.next++; }
    if (idx === null) return;
    sd.lastSend[idx] = t; sd.sentCount[idx]++;
    var retx = sd.sentCount[idx] > 1;
    s.stats.frames++;
    if (retx) s.stats.retx++;
    makeTx('F', idx, t, retx);
  }

  function processTick(t) {
    var i, tx;
    for (i = 0; i < s.txs.length; i++) {
      tx = s.txs[i];
      if (tx.kind === 'A' && !tx.handled && tx.arriveT === t) {
        tx.handled = true;
        if (tx.lost) say(t, 'bad', 'ACK ' + tx.num + ' หายระหว่างทาง');
        else recvAck(tx, t);
      }
    }
    for (i = 0; i < s.txs.length; i++) {
      tx = s.txs[i];
      if (tx.kind === 'F' && !tx.handled && tx.arriveT === t) {
        tx.handled = true;
        if (tx.lost) say(t, 'bad', 'F' + tx.num + (tx.retx ? ' (ส่งซ้ำ)' : '') + ' หายระหว่างทาง ผู้รับไม่รู้เรื่อง จึงไม่ตอบอะไร');
        else recvFrame(tx, t);
      }
    }
    if (s.done) return;
    checkTimeouts(t);
    sendPhase(t);
  }

  s.advanceTo = function (target) {
    while (!s.done && s.t + 1 <= target && s.t + 1 <= maxT) { s.t++; processTick(s.t); }
  };
  s.toggleLoss = function (id, now) {
    var tx = s.txs[id];
    if (tx && !tx.handled && tx.sendT <= now && now < tx.arriveT) { tx.lost = !tx.lost; return true; }
    return false;
  };
  s.runToEnd = function () { s.advanceTo(maxT); return { done: s.done, doneT: s.doneT, frames: s.stats.frames, retx: s.stats.retx }; };
  return s;
}

function r9(x) { return Math.round(x * 1e9) / 1e9; }

function calcTime(p) {
  var rtt = r9(2 * p.dist / p.speed);
  var frames = Math.ceil(r9(p.totalBits / p.frameBits));
  var rounds = Math.ceil(r9(frames / p.n));
  return { rtt: rtt, frames: frames, sw: r9(frames * rtt), rounds: rounds, gbn: r9(rounds * rtt) };
}

function calcBdp(p) {
  var bdp = r9(p.bw * p.rtt);
  return { bdp: bdp, uSw: r9(p.frameBits / bdp), uW: r9(p.w * p.frameBits / bdp), need: Math.ceil(r9(bdp / p.frameBits)) };
}

if (typeof module !== 'undefined') module.exports = { windowSizes: windowSizes, createSim: createSim, calcTime: calcTime, calcBdp: calcBdp };
