using Ticket.DTOs;

namespace Ticket.Services;

public interface IPaymentService
{
    Task<List<PaymentDto>> GetPaymentsAsync();
    Task<PaymentResponseDto> CreatePaymentAsync(CreatePaymentRequest request);
}
