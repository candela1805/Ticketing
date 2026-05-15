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
    private const string InactiveStatus = "Inactive";
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
                        price = sector.Price,
                        capacity = sector.Capacity
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
            Status = NormalizeEventStatus(request.Status)
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

        eventEntity.Sectors = sectors;

        _context.Events.Add(eventEntity);
        _context.Sectors.AddRange(sectors);
        _context.Seats.AddRange(seats);

        await _context.SaveChangesAsync();

        return Created($"/api/v1/events/{eventEntity.Id}", BuildEventResponse(eventEntity));
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
        var user = await GetRequestUserAsync();
        if (user is null || !UserRoles.CanManageEvents(user.Role))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Solo empleados pueden editar eventos" });
        }

        var validationError = ValidateCreateEventRequest(updatedEvent);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var ev = await _context.Events
            .Include(e => e.Sectors)
                .ThenInclude(s => s.Seats)
                    .ThenInclude(se => se.Reservations)
            .Include(e => e.Sectors)
                .ThenInclude(s => s.Seats)
                    .ThenInclude(se => se.Purchases)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null)
        {
            return NotFound(new { message = "Evento no encontrado" });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();

        ev.Name = updatedEvent.Name.Trim();
        ev.Venue = updatedEvent.Venue.Trim();
        ev.EventDate = updatedEvent.EventDate;
        ev.Status = NormalizeEventStatus(updatedEvent.Status);

        var newSeats = new List<Seat>();
        var requestedSectorIds = updatedEvent.Sectors
            .Where(s => s.Id.HasValue)
            .Select(s => s.Id!.Value)
            .ToHashSet();
        var sectorsToRemove = ev.Sectors
            .Where(s => !requestedSectorIds.Contains(s.Id))
            .ToList();

        foreach (var sector in sectorsToRemove)
        {
            var seatsToRemove = sector.Seats.ToList();
            if (HasLockedSeats(seatsToRemove))
            {
                return Conflict(new { message = "No se pueden eliminar sectores con butacas reservadas o vendidas" });
            }

            _context.Seats.RemoveRange(seatsToRemove);
            _context.Sectors.Remove(sector);
        }

        foreach (var sectorRequest in updatedEvent.Sectors)
        {
            if (sectorRequest.Id is null)
            {
                var sector = new Sector
                {
                    Name = sectorRequest.Name.Trim(),
                    Price = sectorRequest.Price,
                    Capacity = sectorRequest.Capacity,
                    Event = ev
                };

                GenerateSeats(sector, newSeats);
                _context.Sectors.Add(sector);
                continue;
            }

            var existingSector = ev.Sectors.FirstOrDefault(s => s.Id == sectorRequest.Id.Value);
            if (existingSector is null)
            {
                return BadRequest(new { message = "Sector invalido para este evento" });
            }

            existingSector.Name = sectorRequest.Name.Trim();
            existingSector.Price = sectorRequest.Price;
            var capacityError = UpdateSectorCapacity(existingSector, sectorRequest.Capacity, newSeats);
            if (capacityError is not null)
            {
                return Conflict(new { message = capacityError });
            }
        }

        _context.Seats.AddRange(newSeats);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(BuildEventResponse(ev));
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

        if (invalidSector)
        {
            return "Todos los sectores deben tener nombre, precio valido y capacidad mayor a cero";
        }

        return IsValidEventStatus(request.Status)
            ? null
            : "El estado del evento no es valido";
    }

    private static bool IsValidEventStatus(string status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return true;
        }

        var normalizedStatus = status.Trim();

        return
            normalizedStatus == ActiveStatus ||
            normalizedStatus == InactiveStatus;
    }

    private static string NormalizeEventStatus(string status)
    {
        return string.IsNullOrWhiteSpace(status) ? ActiveStatus : status.Trim();
    }

    private static object BuildEventResponse(Event eventEntity)
    {
        return new
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
                    price = sector.Price,
                    capacity = sector.Capacity
                })
                .ToList()
        };
    }

    private string? UpdateSectorCapacity(Sector sector, int capacity, ICollection<Seat> newSeats)
    {
        var orderedSeats = GetOrderedSeats(sector);

        if (capacity < orderedSeats.Count)
        {
            var seatsToRemove = orderedSeats.Skip(capacity).ToList();
            if (HasLockedSeats(seatsToRemove))
            {
                return "No se puede reducir la capacidad porque hay butacas reservadas o vendidas";
            }

            _context.Seats.RemoveRange(seatsToRemove);
        }
        else if (capacity > orderedSeats.Count)
        {
            AddGeneratedSeats(sector, newSeats, orderedSeats.Count, capacity);
        }

        sector.Capacity = capacity;
        return null;
    }

    private static bool HasLockedSeats(IEnumerable<Seat> seats)
    {
        return seats.Any(seat =>
            seat.Status != AvailableStatus ||
            seat.Reservations.Count > 0 ||
            seat.Purchases.Count > 0);
    }

    private static List<Seat> GetOrderedSeats(Sector sector)
    {
        return sector.Seats
            .OrderBy(seat => seat.RowIdentifier)
            .ThenBy(seat => seat.SeatNumber)
            .ToList();
    }

    private static void GenerateSeats(Sector sector, ICollection<Seat> seats)
    {
        AddGeneratedSeats(sector, seats, 0, sector.Capacity);
    }

    private static void AddGeneratedSeats(Sector sector, ICollection<Seat> seats, int startIndex, int capacity)
    {
        for (var seatIndex = startIndex; seatIndex < capacity; seatIndex++)
        {
            var row = ((char)('A' + seatIndex / SeatsPerRow)).ToString();
            var seatNumber = seatIndex % SeatsPerRow + 1;

            seats.Add(new Seat
            {
                Id = Guid.NewGuid(),
                Sector = sector,
                RowIdentifier = row,
                SeatNumber = seatNumber,
                Status = AvailableStatus,
                Version = 1
            });
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
