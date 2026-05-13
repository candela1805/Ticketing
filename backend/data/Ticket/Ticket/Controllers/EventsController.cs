using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.DTOs;
using Ticket.Models;
using Ticket.Services;

namespace Ticket.Controllers;

[ApiController]
[Route("api/v1/events")]
public class EventsController : ControllerBase
{
    private const int SeatsPerRow = 10;
    private const string ActiveStatus = "Active";
    private const string AvailableStatus = "Available";

    private readonly AppDbContext _context;
    private readonly IReservationExpirationService _reservationExpirationService;

    public EventsController(
        AppDbContext context,
        IReservationExpirationService reservationExpirationService)
    {
        _context = context;
        _reservationExpirationService = reservationExpirationService;
    }

    [HttpGet]
    public async Task<IActionResult> GetEvents()
    {
        var eventsList = await _context.Events
            .AsNoTracking()
            .Select(eventEntity => new
            {
                id = eventEntity.Id,
                name = eventEntity.Name,
                eventDate = eventEntity.EventDate,
                venue = eventEntity.Venue,
                status = eventEntity.Status,
                sectors = eventEntity.Sectors
                    .Select(sector => new
                    {
                        id = sector.Id,
                        name = sector.Name,
                        price = sector.Price
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(eventsList);
    }

    [HttpPost]
    public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest request)
    {
        var user = await GetRequestUserAsync();
        if (user is null || !UserRoles.CanManageEvents(user.Role))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Solo empleados pueden crear eventos" });
        }

        var validationError = ValidateCreateEventRequest(request);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var eventEntity = new Event
        {
            Name = request.Name.Trim(),
            EventDate = request.EventDate,
            Venue = request.Venue.Trim(),
            Status = ActiveStatus
        };

        var seats = new List<Seat>();
        var sectors = request.Sectors
            .Select(sectorRequest =>
            {
                var sector = new Sector
                {
                    Name = sectorRequest.Name.Trim(),
                    Price = sectorRequest.Price,
                    Capacity = sectorRequest.Capacity,
                    Event = eventEntity
                };

                GenerateSeats(sector, seats);
                return sector;
            })
            .ToList();

        _context.Events.Add(eventEntity);
        _context.Sectors.AddRange(sectors);
        _context.Seats.AddRange(seats);

        await _context.SaveChangesAsync();

        return Created($"/api/v1/events/{eventEntity.Id}", new
        {
            id = eventEntity.Id,
            name = eventEntity.Name,
            eventDate = eventEntity.EventDate,
            venue = eventEntity.Venue,
            status = eventEntity.Status
        });
    }

    [HttpGet("{eventId}/seats")]
    public async Task<IActionResult> GetSeats(int eventId)
    {
        await _reservationExpirationService.ReleaseExpiredReservationsAsync();

        var eventExists = await _context.Events.AnyAsync(eventEntity => eventEntity.Id == eventId);

        if (!eventExists)
        {
            return NotFound(new { message = "Evento no encontrado" });
        }

        var seats = await _context.Seats
            .AsNoTracking()
            .Include(seat => seat.Sector)
            .Where(seat => seat.Sector.EventId == eventId)
            .OrderBy(seat => seat.Sector.Name)
            .ThenBy(seat => seat.RowIdentifier)
            .ThenBy(seat => seat.SeatNumber)
            .Select(seat => new
            {
                id = seat.Id,
                rowIdentifier = seat.RowIdentifier,
                seatNumber = seat.SeatNumber,
                status = seat.Status,
                version = seat.Version,
                sector = new
                {
                    id = seat.Sector.Id,
                    name = seat.Sector.Name,
                    price = seat.Sector.Price
                }
            })
            .ToListAsync();

        return Ok(seats);
    }

    [HttpDelete("{eventId}")]
    public async Task<IActionResult> DeleteEvent(int eventId)
    {
        var ev = await _context.Events
            .Include(e => e.Sectors)
                .ThenInclude(s => s.Seats)
                    .ThenInclude(se => se.Reservations)
            .Include(e => e.Sectors)
                .ThenInclude(s => s.Seats)
                    .ThenInclude(se => se.Purchases)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (ev == null)
        {
            return NotFound(new
            {
                success = false,
                message = "Event not found"
            });
        }

        _context.Purchases.RemoveRange(
            ev.Sectors.SelectMany(s => s.Seats)
                      .SelectMany(se => se.Purchases));

        _context.Reservations.RemoveRange(
            ev.Sectors.SelectMany(s => s.Seats)
                      .SelectMany(se => se.Reservations));

        _context.Seats.RemoveRange(
            ev.Sectors.SelectMany(s => s.Seats));

        _context.Sectors.RemoveRange(ev.Sectors);

        _context.Events.Remove(ev);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Event deleted successfully"
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEvent(int id, [FromBody] CreateEventRequest updatedEvent)
    {
        var ev = await _context.Events
            .Include(e => e.Sectors)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null)
        {
            return NotFound();
        }

        ev.Name = updatedEvent.Name;
        ev.Venue = updatedEvent.Venue;
        ev.EventDate = updatedEvent.EventDate;

        _context.Sectors.RemoveRange(ev.Sectors);

        ev.Sectors = updatedEvent.Sectors.Select(s => new Sector
        {
            Name = s.Name,
            Price = s.Price,
            Capacity = s.Capacity,
            EventId = id
        }).ToList();

        await _context.SaveChangesAsync();

        return Ok(ev);
    }

    private static string? ValidateCreateEventRequest(CreateEventRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "El nombre del evento es obligatorio";
        }

        if (string.IsNullOrWhiteSpace(request.Venue))
        {
            return "El lugar del evento es obligatorio";
        }

        if (request.EventDate == default)
        {
            return "La fecha del evento es obligatoria";
        }

        if (request.Sectors.Count == 0)
        {
            return "El evento necesita al menos un sector";
        }

        var invalidSector = request.Sectors.Any(sector =>
            string.IsNullOrWhiteSpace(sector.Name) ||
            sector.Price < 0 ||
            sector.Capacity <= 0);

        return invalidSector
            ? "Todos los sectores deben tener nombre, precio valido y capacidad mayor a cero"
            : null;
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

    private async Task<User?> GetRequestUserAsync()
    {
        if (!Request.Headers.TryGetValue("X-User-Id", out var userIdHeader) ||
            !int.TryParse(userIdHeader, out var userId))
        {
            return null;
        }

        return await _context.Users.FindAsync(userId);
    }
}
