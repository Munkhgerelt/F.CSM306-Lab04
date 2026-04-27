#include <mpi.h>
#include <stdio.h>
#include <stdlib.h>

#define TOTAL_POINTS 4096
#define DEFAULT_STEPS 1000
#define DIFFUSION_COEFFICIENT 0.25
#define LEFT_TEMPERATURE 100.0
#define RIGHT_TEMPERATURE 0.0

static void die_if_null(void *pointer, const char *name, int rank)
{
    if (pointer == NULL)
    {
        fprintf(stderr, "Rank %d: failed to allocate %s\n", rank, name);
        MPI_Abort(MPI_COMM_WORLD, EXIT_FAILURE);
    }
}

static int parse_positive_int(const char *text, int fallback)
{
    if (text == NULL)
    {
        return fallback;
    }

    char *end = NULL;
    long value = strtol(text, &end, 10);
    if (*text == '\0' || *end != '\0' || value <= 0)
    {
        return fallback;
    }

    return (int)value;
}

static void exchange_boundaries(double *current, int local_n, int rank, int size)
{
    int left = rank == 0 ? MPI_PROC_NULL : rank - 1;
    int right = rank == size - 1 ? MPI_PROC_NULL : rank + 1;

    MPI_Sendrecv(&current[1], 1, MPI_DOUBLE, left, 0,
                 &current[local_n + 1], 1, MPI_DOUBLE, right, 0,
                 MPI_COMM_WORLD, MPI_STATUS_IGNORE);

    MPI_Sendrecv(&current[local_n], 1, MPI_DOUBLE, right, 1,
                 &current[0], 1, MPI_DOUBLE, left, 1,
                 MPI_COMM_WORLD, MPI_STATUS_IGNORE);
}

static void write_csv(const char *path, const double *temperatures, int count)
{
    FILE *file = fopen(path, "w");
    if (file == NULL)
    {
        fprintf(stderr, "Could not write %s\n", path);
        MPI_Abort(MPI_COMM_WORLD, EXIT_FAILURE);
    }

    fprintf(file, "position,temperature\n");
    for (int i = 0; i < count; ++i)
    {
        fprintf(file, "%d,%.6f\n", i, temperatures[i]);
    }

    fclose(file);
}

int main(int argc, char **argv)
{
    MPI_Init(&argc, &argv);

    int rank = 0;
    int size = 0;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    if (TOTAL_POINTS % size != 0)
    {
        if (rank == 0)
        {
            fprintf(stderr, "TOTAL_POINTS must be divisible by the MPI process count.\n");
        }
        MPI_Finalize();
        return EXIT_FAILURE;
    }

    int steps = parse_positive_int(argc > 1 ? argv[1] : NULL, DEFAULT_STEPS);
    const char *output_path = argc > 2 ? argv[2] : "output.csv";
    int local_n = TOTAL_POINTS / size;

    double *current = calloc((size_t)local_n + 2, sizeof(double));
    double *next = calloc((size_t)local_n + 2, sizeof(double));
    die_if_null(current, "current", rank);
    die_if_null(next, "next", rank);

    if (rank == 0)
    {
        current[1] = LEFT_TEMPERATURE;
    }

    if (rank == size - 1)
    {
        current[local_n] = RIGHT_TEMPERATURE;
    }

    double start_time = MPI_Wtime();

    for (int step = 0; step < steps; ++step)
    {
        if (rank == 0)
        {
            current[1] = LEFT_TEMPERATURE;
            current[0] = LEFT_TEMPERATURE;
        }
        if (rank == size - 1)
        {
            current[local_n] = RIGHT_TEMPERATURE;
            current[local_n + 1] = RIGHT_TEMPERATURE;
        }

        exchange_boundaries(current, local_n, rank, size);

        for (int i = 1; i <= local_n; ++i)
        {
            next[i] = current[i];
        }

        int start = rank == 0 ? 2 : 1;
        int end = rank == size - 1 ? local_n - 1 : local_n;

        for (int i = start; i <= end; ++i)
        {
            next[i] = current[i] +
                      DIFFUSION_COEFFICIENT *
                          (current[i - 1] - 2.0 * current[i] + current[i + 1]);
        }

        if (rank == 0)
        {
            next[1] = LEFT_TEMPERATURE;
        }
        if (rank == size - 1)
        {
            next[local_n] = RIGHT_TEMPERATURE;
        }

        double *swap = current;
        current = next;
        next = swap;
    }

    double elapsed = MPI_Wtime() - start_time;
    double *all_temperatures = NULL;

    if (rank == 0)
    {
        all_temperatures = malloc((size_t)TOTAL_POINTS * sizeof(double));
        die_if_null(all_temperatures, "all_temperatures", rank);
    }

    MPI_Gather(&current[1], local_n, MPI_DOUBLE,
               all_temperatures, local_n, MPI_DOUBLE,
               0, MPI_COMM_WORLD);

    if (rank == 0)
    {
        write_csv(output_path, all_temperatures, TOTAL_POINTS);
        printf("MPI heat diffusion completed\n");
        printf("processes: %d\n", size);
        printf("points: %d\n", TOTAL_POINTS);
        printf("steps: %d\n", steps);
        printf("output: %s\n", output_path);
        printf("elapsed_seconds: %.6f\n", elapsed);
        free(all_temperatures);
    }

    free(current);
    free(next);

    MPI_Finalize();
    return EXIT_SUCCESS;
}
