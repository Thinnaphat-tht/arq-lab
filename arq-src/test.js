var e = require('./engine.js');
var fails = 0;
function eq(name, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)));
}

// window sizes
var g = e.windowSizes('gbn', 4), s = e.windowSizes('sr', 4), w = e.windowSizes('sw', 4);
eq('m=4 GBN', [g.M, g.ws, g.wr], [16, 15, 1]);
eq('m=4 SR', [s.M, s.ws, s.wr], [16, 8, 8]);
eq('m=5 GBN/SR', [e.windowSizes('gbn', 5).ws, e.windowSizes('sr', 5).ws], [31, 16]);
eq('S&W', [w.M, w.ws, w.wr], [2, 1, 1]);

// calculator examples from Notion
var a = e.calcTime({ dist: 1000, speed: 500, frameBits: 100, totalBits: 1000, n: 2 });
eq('time RTT/frames/SW/GBN', [a.rtt, a.frames, a.sw, a.rounds, a.gbn], [4, 10, 40, 5, 20]);
var b = e.calcBdp({ bw: 1e6, rtt: 0.02, frameBits: 1000, w: 15 });
eq('BDP 1Mbps 20ms', [b.bdp, b.uSw, b.uW, b.need], [20000, 0.05, 0.75, 20]);
var c = e.calcBdp({ bw: 2e6, rtt: 0.01, frameBits: 2000, w: 1 });
eq('BDP 2Mbps 10ms', [c.bdp, c.uSw, c.need], [20000, 0.1, 10]);

// scenario: frame 2 lost, send 0..5
function run(mode, m, N, rules) { var sim = e.createSim({ mode: mode, m: m, N: N, rules: rules }); sim.runToEnd(); return sim; }
function retxList(sim) { return sim.txs.filter(function (t) { return t.kind === 'F' && t.retx; }).map(function (t) { return t.num; }); }

var lose2 = [{ kind: 'F', idx: 2, attempt: 1, lose: true }];
var gb = run('gbn', 3, 6, lose2), sr = run('sr', 3, 6, lose2);
eq('GBN done', gb.done, true);
eq('GBN retransmits 2,3,4,5', retxList(gb), [2, 3, 4, 5]);
eq('SR done', sr.done, true);
eq('SR retransmits only 2', retxList(sr), [2]);
console.log('  GBN time=' + gb.doneT + ' frames=' + gb.stats.frames + ' | SR time=' + sr.doneT + ' frames=' + sr.stats.frames);
eq('SR faster than GBN', sr.doneT < gb.doneT, true);

// no-error runs
var clean = run('gbn', 3, 6, []);
eq('GBN clean: no retx', clean.stats.retx, 0);
eq('S&W clean 3 frames takes 3 RTT', run('sw', 1, 3, []).doneT, 3 * 6 - 0);

// ACK2 lost, ACK3 arrives in time -> no retx (GBN, 5 frames)
var ackLoss = run('gbn', 3, 5, [{ kind: 'A', idx: 2, attempt: 1, lose: true }]);
eq('GBN ACK2 lost, no retransmission', ackLoss.stats.retx, 0);
eq('GBN ACK2 lost, still done', ackLoss.done, true);

// S&W delayed ACK -> duplicate frame, receiver re-ACKs, sender ignores stale ACK
var late = run('sw', 1, 3, [{ kind: 'A', idx: 1, attempt: 1, delay: 4 }]);
eq('S&W late ACK done', late.done, true);
eq('S&W late ACK: retransmit F0 once', retxList(late), [0]);
var texts = late.log.map(function (l) { return l.text; }).join('\n');
eq('S&W receiver discards duplicate and re-ACKs', /ซ้ำ.*ทิ้งเฟรมนี้ แต่ตอบ ACK 1 อีกครั้ง/.test(texts), true);
eq('S&W sender ignores stale ACK', /ACK 1 เก่า/.test(texts), true);

// wrap-around: m=2, 8 frames, sequence numbers cycle
var wrap = run('gbn', 2, 8, []);
eq('wrap seq numbers', wrap.txs.filter(function (t) { return t.kind === 'F'; }).map(function (t) { return t.num; }), [0, 1, 2, 3, 0, 1, 2, 3]);
eq('wrap done, GBN m=2 W=3', [wrap.done, wrap.ws], [true, 3]);

// user toggles loss while in flight
var live = e.createSim({ mode: 'gbn', m: 3, N: 4, rules: [] });
live.advanceTo(1);
eq('toggle in flight ok', live.toggleLoss(0, 1), true);
eq('toggle after arrival rejected', (function () { live.advanceTo(4); return live.toggleLoss(0, 4); })(), false);

// robustness: every mode/m/N combination with a lost first attempt of every frame finishes
var bad = 0;
['sw', 'gbn', 'sr'].forEach(function (mode) {
  [2, 3, 4].forEach(function (m) {
    [6, 8, 10].forEach(function (N) {
      for (var i = 0; i < N; i++) {
        var r = run(mode, m, N, [{ kind: 'F', idx: i, attempt: 1, lose: true }, { kind: 'A', idx: i + 1, attempt: 1, lose: true }]);
        if (!r.done) { bad++; console.log('  stuck: ' + mode + ' m=' + m + ' N=' + N + ' i=' + i); }
      }
    });
  });
});
eq('all combos finish', bad, 0);

console.log(fails ? ('\n' + fails + ' FAILED') : '\nALL PASSED');
process.exit(fails ? 1 : 0);
