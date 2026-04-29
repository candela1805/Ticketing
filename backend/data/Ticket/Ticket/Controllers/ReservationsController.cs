using Microsoft.AspNetCore.Mvc;
using Ticket.DTOs;
using Ticket.Services;

namespace Ticket.Controllers;

[ApiController]
[Route("api/v1/reservations")]
public class ReservationsController : ControllerBase
{
    private readonly ILogger<ReservationsController> _logger;
    private readonly IReservationService _reservationService;

    public ReservationsController(
        IReservationService reservationService,
        ILogger<ReservationsController> logger)
    {
        _reservationService = reservationService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequest request)
    {
        try
        {
            var result = await _reservationService.CreateReservationAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating reservation.");
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "No se pudo crear la reserva" });
        }
    }
}
