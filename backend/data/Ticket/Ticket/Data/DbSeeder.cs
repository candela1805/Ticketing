using Microsoft.EntityFrameworkCore;
using Ticket.Models;
using Ticket.Services;

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

    public static async Task SeedAsync(AppDbContext context, IPasswordHashService passwordHashService)
    {
        await EnsureRoleColumnAsync(context);
        await EnsureEmployeesTableAsync(context);
        await EnsureClientsTableAsync(context);
        await EnsurePurchasesTableAsync(context);
        await EnsurePurchasePaymentMethodColumnAsync(context);
        await EnsureEmployeeUserAsync(context, passwordHashService);
        await EnsureAdminUserAsync(context, passwordHashService);

        foreach (var demoEvent in DemoEvents)
        {
            await EnsureDemoEventAsync(context, demoEvent);
        }

        await context.SaveChangesAsync();
    }

    private static async Task EnsureRoleColumnAsync(AppDbContext context)
    {
        await context.Database.ExecuteSqlRawAsync("""
            ALTER TABLE `Users`
            ADD COLUMN IF NOT EXISTS `Role` varchar(32) NOT NULL DEFAULT 'Client';
            """);
    }

    private static async Task EnsureEmployeesTableAsync(AppDbContext context)
    {
        await context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS `Employees` (
                `Id` int NOT NULL AUTO_INCREMENT,
                `UserId` int NOT NULL,
                `DocumentNumber` varchar(64) NOT NULL,
                `Phone` varchar(64) NOT NULL,
                `CreatedAt` datetime(6) NOT NULL,
                CONSTRAINT `PK_Employees` PRIMARY KEY (`Id`),
                UNIQUE KEY `IX_Employees_UserId` (`UserId`),
                UNIQUE KEY `IX_Employees_DocumentNumber` (`DocumentNumber`),
                CONSTRAINT `FK_Employees_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
            ) CHARACTER SET=utf8mb4;
            """);
    }

    private static async Task EnsureClientsTableAsync(AppDbContext context)
    {
        await context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS `Clients` (
                `Id` int NOT NULL AUTO_INCREMENT,
                `UserId` int NOT NULL,
                `CreatedAt` datetime(6) NOT NULL,
                CONSTRAINT `PK_Clients` PRIMARY KEY (`Id`),
                UNIQUE KEY `IX_Clients_UserId` (`UserId`),
                CONSTRAINT `FK_Clients_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
            ) CHARACTER SET=utf8mb4;
            """);
    }

    private static async Task EnsurePurchasesTableAsync(AppDbContext context)
    {
        await context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS `Purchases` (
                `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                `UserId` int NOT NULL,
                `ReservationId` char(36) COLLATE ascii_general_ci NOT NULL,
                `SeatId` char(36) COLLATE ascii_general_ci NOT NULL,
                `PurchasedAt` datetime(6) NOT NULL,
                `Status` longtext NOT NULL,
                `PaymentMethod` longtext NOT NULL,
                CONSTRAINT `PK_Purchases` PRIMARY KEY (`Id`),
                UNIQUE KEY `IX_Purchases_ReservationId` (`ReservationId`),
                KEY `IX_Purchases_UserId` (`UserId`),
                KEY `IX_Purchases_SeatId` (`SeatId`),
                CONSTRAINT `FK_Purchases_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
                CONSTRAINT `FK_Purchases_Reservations_ReservationId` FOREIGN KEY (`ReservationId`) REFERENCES `Reservations` (`Id`) ON DELETE RESTRICT,
                CONSTRAINT `FK_Purchases_Seats_SeatId` FOREIGN KEY (`SeatId`) REFERENCES `Seats` (`Id`) ON DELETE RESTRICT
            ) CHARACTER SET=utf8mb4;
            """);
    }

    private static async Task EnsurePurchasePaymentMethodColumnAsync(AppDbContext context)
    {
        await context.Database.ExecuteSqlRawAsync("""
            ALTER TABLE `Purchases`
            ADD COLUMN IF NOT EXISTS `PaymentMethod` longtext NOT NULL;
            """);
    }

    private static async Task EnsureEmployeeUserAsync(
        AppDbContext context,
        IPasswordHashService passwordHashService)
    {
        const string employeeEmail = "employee@test.com";

        var employee = await context.Users
            .FirstOrDefaultAsync(u => u.Email == employeeEmail);

        if (employee is not null)
        {
            employee.Name = "Empleado Demo";
            employee.Role = UserRoles.Employee;
            employee.PasswordHash = passwordHashService.HashPassword("employee");
            return;
        }

        context.Users.Add(new User
        {
            Name = "Empleado Demo",
            Email = employeeEmail,
            Role = UserRoles.Employee,
            PasswordHash = passwordHashService.HashPassword("employee")
        });
    }

    private static async Task EnsureAdminUserAsync(
        AppDbContext context,
        IPasswordHashService passwordHashService)
    {
        const string adminEmail = "admin@admin.com";
        var admin = await context.Users.FirstOrDefaultAsync(user => user.Email == adminEmail);

        if (admin is not null)
        {
            admin.Name = "admin";
            admin.Role = UserRoles.Admin;
            admin.PasswordHash = passwordHashService.HashPassword("admin");
            return;
        }

        context.Users.Add(new User
        {
            Name = "admin",
            Email = adminEmail,
            Role = UserRoles.Admin,
            PasswordHash = passwordHashService.HashPassword("admin")
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
