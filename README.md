# F.CSM306 Lab 04

This repository contains two separate lab tasks.

## Task 1: Distributed Chat, Load Balancing, Fault Tolerance

Task 1 is a Node.js and Socket.IO simulation with two servers:

- Server A: `http://localhost:8001`
- Server B: `http://localhost:8002`
- Gateway/UI: `http://localhost:8000`

The gateway routes clients by client ID:

- Even client IDs go to Server A.
- Odd client IDs go to Server B.
- If Server A is down, new clients are sent to Server B.

Servers exchange messages with each other, so a message received by one server can be delivered to clients connected to the other server.

Run:

```bash
cd task1
npm install
npm start
```

Then open `http://localhost:8000` in several browser tabs and connect clients such as `1`, `2`, `3`, and `4`.

To run each process separately:

```bash
npm run server:a
npm run server:b
npm run gateway
```

Fault tolerance demo:

1. Start all services.
2. Connect several clients.
3. Stop Server A.
4. Clients connected through Server B continue chatting.
5. New even-ID clients are routed to Server B while A is unavailable.

## Task 2: MPI 1D Heat Diffusion

Task 2 calculates heat diffusion along a metal rod represented as a 1D array.

Defaults:

- Total points: `N = 4096`
- Expected MPI processes: `4`
- Local points per process: `1024`
- Left boundary temperature: `100.0`
- Initial temperature elsewhere: `0.0`
- Diffusion coefficient: `C = 0.25`
- Time steps: configurable, use `100` and `1000` for the lab

Compile and run:

```bash
cd task2
mpicc heat_mpi.c -o heat_mpi -lm
mpirun -n 4 ./heat_mpi 100 output_100.csv
mpirun -n 4 ./heat_mpi 1000 output_1000.csv
```

Generate an SVG graph:

```bash
python plot_heat.py output_1000.csv heat_distribution.svg
```

The CSV format is:

```csv
position,temperature
0,100.000000
1,99.800000
...
4095,0.000000
```
