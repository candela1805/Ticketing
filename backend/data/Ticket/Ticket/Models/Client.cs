using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ticket.Models;

public class Client
{
    [Key]
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; }

    [ForeignKey("UserId")]
    public User User { get; set; } = null!;
}
