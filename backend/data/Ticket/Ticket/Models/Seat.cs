using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ticket.Models;

public class Seat
{
    [Key]
    public Guid Id { get; set; }
    public int SectorId { get; set; }
    public string RowIdentifier { get; set; } = string.Empty;
    public int SeatNumber { get; set; }
    public string Status { get; set; } = "Available";
    public int Version { get; set; } = 1;

    [ForeignKey("SectorId")]
    public Sector Sector { get; set; } = null!;

    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
