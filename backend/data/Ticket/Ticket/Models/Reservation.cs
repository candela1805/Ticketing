using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ticket.Models;

public class Reservation
{
    [Key]
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public Guid SeatId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime ReservedAt { get; set; }
    public DateTime ExpiresAt { get; set; }

    [ForeignKey("UserId")]
    public User User { get; set; } = null!;

    [ForeignKey("SeatId")]
    public Seat Seat { get; set; } = null!;
}
