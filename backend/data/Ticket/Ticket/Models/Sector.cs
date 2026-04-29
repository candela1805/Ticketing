using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ticket.Models;

public class Sector
{
    [Key]
    public int Id { get; set; }
    public int EventId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Capacity { get; set; }

    [ForeignKey("EventId")]
    public Event Event { get; set; } = null!;

    public ICollection<Seat> Seats { get; set; } = new List<Seat>();
}
