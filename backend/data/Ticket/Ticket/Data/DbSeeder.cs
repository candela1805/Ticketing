using Microsoft.EntityFrameworkCore;
using Ticket.Models;

namespace Ticket.Data;

public static class DbSeeder
{
    private const int SeatsPerRow = 10;
    private const string AvailableStatus = "Available";

    private static readonly DemoEvent[] DemoEvents =
    [
        new(
            "Concierto de Rock",
            DateTime.UtcNow.AddDays(10),
            "Estadio",
            [
                new("Campo", 10000, 50),
                new("Platea", 20000, 50)
            ]),
        new(
            "Festival Electronico",
            DateTime.UtcNow.AddDays(18),
            "Predio Ferial",
            [
                new("General", 12000, 80),
                new("VIP", 28000, 40)
            ]),
        new(
            "Obra de Teatro",
            DateTime.UtcNow.AddDays(25),
            "Teatro Central",
            [
                new("Pullman", 9000, 40),
                new("Platea Baja", 15000, 60)
            ]),
        new(
            "Final de Futbol",
            DateTime.UtcNow.AddDays(32),
            "Estadio Municipal",
            [
                new("Popular", 8000, 100),
                new("Preferencial", 18000, 60)
            ])
    ];

    public static async Task SeedAsync(AppDbContext context)
    {
        await EnsureDemoUserAsync(context);

        foreach (var demoEvent in DemoEvents)
        {
            await EnsureDemoEventAsync(context, demoEvent);
        }

        await context.SaveChangesAsync();
    }

    private static async Task EnsureDemoUserAsync(AppDbContext context)
    {
        var userExists = await context.Users.AnyAsync(user => user.Email == "demo@test.com");

        if (userExists)
        {
            return;
        }

        context.Users.Add(new User
        {
            Name = "Cliente Demo",
            Email = "demo@test.com",
            PasswordHash = "1234"
        });
    }

    private static async Task EnsureDemoEventAsync(AppDbContext context, DemoEvent demoEvent)
    {
        var eventExists = await context.Events.AnyAsync(eventEntity =>
            eventEntity.Name == demoEvent.Name && eventEntity.Venue == demoEvent.Venue);

        if (eventExists)
        {
            return;
        }

        var eventEntity = new Event
        {
            Name = demoEvent.Name,
            EventDate = demoEvent.EventDate,
            Venue = demoEvent.Venue,
            Status = "Active"
        };

        var seats = new List<Seat>();
        var sectors = demoEvent.Sectors
            .Select(sector =>
            {
                var sectorEntity = new Sector
                {
                    Name = sector.Name,
                    Price = sector.Price,
                    Capacity = sector.Capacity,
                    Event = eventEntity
                };

                GenerateSeats(sectorEntity, seats);
                return sectorEntity;
            })
            .ToList();

        context.Events.Add(eventEntity);
        context.Sectors.AddRange(sectors);
        context.Seats.AddRange(seats);
    }

    private static void GenerateSeats(Sector sector, ICollection<Seat> seats)
    {
        var rowsNeeded = (int)Math.Ceiling((double)sector.Capacity / SeatsPerRow);
        var generatedSeats = 0;

        for (var rowIndex = 0; rowIndex < rowsNeeded; rowIndex++)
        {
            var row = ((char)('A' + rowIndex)).ToString();

            for (var seatNumber = 1; seatNumber <= SeatsPerRow; seatNumber++)
            {
                if (generatedSeats >= sector.Capacity)
                {
                    return;
                }

                seats.Add(new Seat
                {
                    Id = Guid.NewGuid(),
                    Sector = sector,
                    RowIdentifier = row,
                    SeatNumber = seatNumber,
                    Status = AvailableStatus,
                    Version = 1
                });

                generatedSeats++;
            }
        }
    }

    private sealed record DemoEvent(
        string Name,
        DateTime EventDate,
        string Venue,
        IReadOnlyCollection<DemoSector> Sectors);

    private sealed record DemoSector(
        string Name,
        decimal Price,
        int Capacity);
}
