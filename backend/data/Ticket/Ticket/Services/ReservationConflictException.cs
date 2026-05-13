namespace Ticket.Services;

public class ReservationConflictException : Exception
{
    public ReservationConflictException(string message) : base(message)
    {
    }
}
