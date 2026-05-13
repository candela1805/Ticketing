using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Ticket.Models;

public class Employee
{
    [Key]
    public int Id { get; set; }
    public int UserId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    [ForeignKey("UserId")]
    public User User { get; set; } = null!;
}
