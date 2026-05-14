using System.ComponentModel.DataAnnotations;

namespace Ticket.Models;

public class User
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Client;
    public string PasswordHash { get; set; } = string.Empty;

    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
    public ICollection<Purchase> Purchases { get; set; } = new List<Purchase>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public Employee? Employee { get; set; }
    public Client? Client { get; set; }
}
