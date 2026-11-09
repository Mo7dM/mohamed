// A small version of smart-road: cars cross an intersection with no lights.
// When a car spawns it books a time slot in the middle of the intersection.
// If a car from the crossing road already has that slot, it takes the next
// free one and drives slower so it arrives on time instead of stopping.

(() => {
    const canvas = document.getElementById('road');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const counter = document.getElementById('road-count');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');

    const LANE = 9;        // lane width, px
    const ROAD = LANE * 2; // one lane each way
    const CAR_L = 12;
    const CAR_W = 6;
    const V_MAX = 70;      // px/s
    const GAP = 6;         // min distance to the car ahead, px
    const MARGIN = 0.15;   // min time between crossing cars, s

    // sign: which way along the axis the car drives.
    // side: which half of the road its lane is on (cars keep right).
    const DIRS = [
        { axis: 'h', sign: 1, side: 1 },   // east
        { axis: 'h', sign: -1, side: -1 }, // west
        { axis: 'v', sign: 1, side: -1 },  // south
        { axis: 'v', sign: -1, side: 1 },  // north
    ];

    let W = 0;
    let H = 0;
    let cars = [];
    let time = 0;
    let nextSpawn = 0;
    let passed = 0;
    let colors = {};
    let raf = 0;
    let last = 0;

    const lengthOf = (dir) => (dir.axis === 'h' ? W : H);
    // A car's position `s` is how far its front has driven along its lane.
    const enterAt = (dir) => lengthOf(dir) / 2 - ROAD / 2;
    const exitAt = (dir) => lengthOf(dir) / 2 + ROAD / 2 + CAR_L;

    function inBox(car) {
        const dir = DIRS[car.d];
        return car.s > enterAt(dir) && car.s < exitAt(dir);
    }

    function spawn() {
        const d = Math.floor(Math.random() * DIRS.length);
        const dir = DIRS[d];
        const ahead = cars.filter((c) => c.d === d).pop();
        if (ahead && ahead.s < CAR_L + GAP * 2) return;

        const duration = (exitAt(dir) - enterAt(dir)) / V_MAX;
        let tIn = time + enterAt(dir) / V_MAX;
        if (ahead) tIn = Math.max(tIn, ahead.tIn + (CAR_L + GAP) / V_MAX);
        const queued = tIn;

        // Move the slot past every booking from the crossing road it overlaps
        const crossing = cars.filter((c) => DIRS[c.d].axis !== dir.axis);
        for (let moved = true; moved; ) {
            moved = false;
            for (const c of crossing) {
                if (tIn < c.tOut + MARGIN && tIn + duration + MARGIN > c.tIn) {
                    tIn = c.tOut + MARGIN;
                    moved = true;
                }
            }
        }

        cars.push({ d, s: 0, tIn, tOut: tIn + duration, yielding: tIn - queued > 0.05, counted: false });
    }

    function step(dt) {
        time += dt;
        if (time >= nextSpawn) {
            spawn();
            nextSpawn = time + 0.3 + Math.random() * 0.8;
        }

        const lastInLane = [];
        for (const car of cars) {
            const dir = DIRS[car.d];
            const enter = enterAt(dir);

            // Before the box, drive at whatever speed reaches it on time
            let v = V_MAX;
            if (car.s < enter && car.tIn > time) {
                v = Math.min(V_MAX, (enter - car.s) / (car.tIn - time));
            }

            let s = car.s + v * dt;
            const ahead = lastInLane[car.d];
            if (ahead) s = Math.min(s, ahead.s - CAR_L - GAP);
            // Late cars never enter while a crossing car is still inside
            if (car.s <= enter && s > enter && cars.some((c) => DIRS[c.d].axis !== dir.axis && inBox(c))) {
                s = enter;
            }

            car.s = Math.max(car.s, s);
            lastInLane[car.d] = car;

            if (!car.counted && car.s > exitAt(dir)) {
                car.counted = true;
                passed++;
            }
        }

        cars = cars.filter((c) => c.s < lengthOf(DIRS[c.d]) + CAR_L);
    }

    function draw() {
        const cx = W / 2;
        const cy = H / 2;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = colors.road;
        ctx.fillRect(0, cy - ROAD / 2, W, ROAD);
        ctx.fillRect(cx - ROAD / 2, 0, ROAD, H);

        const lx = Math.floor(cx) + 0.5;
        const ly = Math.floor(cy) + 0.5;
        ctx.strokeStyle = colors.mark;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(cx - ROAD / 2, ly);
        ctx.moveTo(cx + ROAD / 2, ly);
        ctx.lineTo(W, ly);
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, cy - ROAD / 2);
        ctx.moveTo(lx, cy + ROAD / 2);
        ctx.lineTo(lx, H);
        ctx.stroke();
        ctx.setLineDash([]);

        for (const car of cars) {
            const dir = DIRS[car.d];
            const front = dir.sign > 0 ? car.s : lengthOf(dir) - car.s;
            const back = dir.sign > 0 ? front - CAR_L : front;
            const lane = (dir.axis === 'h' ? cy : cx) + (dir.side * LANE) / 2 - CAR_W / 2;

            ctx.fillStyle = car.yielding ? colors.accent : colors.car;
            ctx.beginPath();
            if (dir.axis === 'h') roundRect(back, lane, CAR_L, CAR_W);
            else roundRect(lane, back, CAR_W, CAR_L);
            ctx.fill();
        }
    }

    function roundRect(x, y, w, h) {
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, 2);
        else ctx.rect(x, y, w, h);
    }

    function updateCounter() {
        const text = `${passed} ${passed === 1 ? 'car' : 'cars'} through`;
        if (counter.textContent !== text) counter.textContent = text;
    }

    function readColors() {
        const css = getComputedStyle(document.documentElement);
        const get = (name) => css.getPropertyValue(name).trim();
        colors = { road: get('--road'), mark: get('--road-mark'), car: get('--text'), accent: get('--link') };
    }

    function resize() {
        const width = Math.round(canvas.clientWidth);
        const height = Math.round(canvas.clientHeight);
        if (width === W && height === H) return;

        W = width;
        H = height;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Start with traffic already on the road
        cars = [];
        time = 0;
        nextSpawn = 0;
        passed = 0;
        for (let i = 0; i < 600; i++) step(1 / 60);
        draw();
        updateCounter();
    }

    function frame(now) {
        step(Math.min((now - last) / 1000, 1 / 20));
        last = now;
        draw();
        updateCounter();
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (raf || reduceMotion) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function stop() {
        cancelAnimationFrame(raf);
        raf = 0;
    }

    readColors();
    resize();
    new ResizeObserver(resize).observe(canvas);
    darkMode.addEventListener('change', () => {
        readColors();
        draw();
    });
    // Only run while the canvas is on screen
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(canvas);
})();
