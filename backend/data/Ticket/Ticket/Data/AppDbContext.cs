using Microsoft.EntityFrameworkCore;
using Ticket.Models;

namespace Ticket.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Event> Events => Set<Event>();
    public DbSet<Sector> Sectors => Set<Sector>();
    public DbSet<Seat> Seats => Set<Seat>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Event>().ToTable("Events");
        modelBuilder.Entity<Sector>().ToTable("Sectors");
        modelBuilder.Entity<Seat>().ToTable("Seats");
        modelBuilder.Entity<User>().ToTable("Users");
        modelBuilder.Entity<Reservation>().ToTable("Reservations");
        modelBuilder.Entity<AuditLog>().ToTable("AuditLogs");

        modelBuilder.Entity<Sector>()
            .HasOne(sector => sector.Event)
            .WithMany(eventEntity => eventEntity.Sectors)
            .HasForeignKey(sector => sector.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Seat>()
            .HasOne(seat => seat.Sector)
            .WithMany(sector => sector.Seats)
            .HasForeignKey(seat => seat.SectorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Reservation>()
            .HasOne(reservation => reservation.User)
            .WithMany(user => user.Reservations)
            .HasForeignKey(reservation => reservation.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Reservation>()
            .HasOne(reservation => reservation.Seat)
            .WithMany(seat => seat.Reservations)
            .HasForeignKey(reservation => reservation.SeatId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AuditLog>()
            .HasOne(auditLog => auditLog.User)
            .WithMany(user => user.AuditLogs)
            .HasForeignKey(auditLog => auditLog.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<User>()
            .HasIndex(user => user.Email)
            .IsUnique();

        modelBuilder.Entity<Seat>()
            .HasIndex(seat => new { seat.SectorId, seat.RowIdentifier, seat.SeatNumber })
            .IsUnique();

        modelBuilder.Entity<Seat>()
            .Property(seat => seat.Version)
            .IsConcurrencyToken();
    }
}
