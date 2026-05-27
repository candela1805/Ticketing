using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticket.DTOs;
using Ticket.Services;

namespace Ticket.Controllers;

[ApiController]
[Route("api/v1/payments")]
public class PaymentsController : ControllerBase
{
    private readonly ILogger<PaymentsController> _logger;
    private readonly IPaymentService _paymentService;

    public PaymentsController(
        IPaymentService paymentService,
        ILogger<PaymentsController> logger)
    {
        _paymentService = paymentService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreatePayment([FromBody] CreatePaymentRequest request)
    {
        try
        {
            var result = await _paymentService.CreatePaymentAsync(request);
            return Ok(result);
        }
        catch (ReservationConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating payment.");
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "No se pudo procesar el pago" });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetPayments()
    {
        var payments = await _paymentService.GetPaymentsAsync();
        return Ok(payments);
    }

}
